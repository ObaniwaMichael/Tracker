"""
Truecaller-style caller ID API.

Run locally:
    uvicorn main:app --reload
    (or: python -m uvicorn main:app --reload, if 'uvicorn' isn't on PATH)
Then open http://127.0.0.1:8000/ for the web UI,
or http://127.0.0.1:8000/docs for interactive Swagger UI.

Core capabilities:
  - Register a user by their own phone number
  - Bulk-upload a user's phone contacts (crowdsources the name<->number graph)
  - Look up a number: best-guess name, how many people saved that name,
    numbering-plan region/carrier hint, and spam-report stats
  - Search contacts by name (reverse of the above), with region on each hit
  - Persist numbering-plan location each time a number is searched/looked up
  - Report a number as spam/scam/telemarketer

What this deliberately does NOT do: return a device's live or historical
GPS/cell location. See phone_utils.py for what "region_hint" actually means.
"""
from collections import Counter
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlmodel import Session, SQLModel, create_engine, select

from models import Contact, LookupEvent, SpamReport, User
from phone_utils import InvalidPhoneNumber, normalize, number_metadata

DATABASE_URL = "sqlite:///./truecaller_clone.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


def get_session():
    with Session(engine) as session:
        yield session


app = FastAPI(
    title="Caller ID API (Truecaller-style)",
    description="Crowdsourced caller-ID lookup, spam reporting, and public "
    "numbering-plan metadata stored per search. No live GPS tracking.",
    version="1.0.0",
)


@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)


app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/", include_in_schema=False)
def serve_ui():
    """Serves the simple web UI (static/index.html) at the site root."""
    return FileResponse("static/index.html")


# ---------- Request/response schemas ----------

class RegisterUserRequest(BaseModel):
    phone_number: str = Field(..., examples=["+2348012345678"])
    display_name: str = Field(..., min_length=1, max_length=80)
    default_region: str = Field(
        default="NG", description="ISO country code used to parse local-format numbers"
    )


class ContactIn(BaseModel):
    saved_name: str = Field(..., min_length=1, max_length=120)
    phone_number: str


class UploadContactsRequest(BaseModel):
    owner_id: int
    contacts: List[ContactIn]
    default_region: str = "NG"


class SpamReportRequest(BaseModel):
    phone_number: str
    reporter_id: int
    category: str = Field(default="spam", pattern="^(spam|scam|telemarketer|fraud)$")
    default_region: str = "NG"


def record_lookup(session: Session, e164: str, meta: dict, source: str) -> LookupEvent:
    event = LookupEvent(
        phone_number=e164,
        region_hint=meta.get("region_hint") or "",
        carrier_hint=meta.get("carrier_hint") or "",
        line_type=meta.get("line_type") or "",
        source=source,
    )
    session.add(event)
    return event


def serialize_event(event: LookupEvent) -> dict:
    return {
        "phone_number": event.phone_number,
        "region_hint": event.region_hint or None,
        "carrier_hint": event.carrier_hint or None,
        "line_type": event.line_type or None,
        "source": event.source,
        "looked_up_at": event.looked_up_at.isoformat() if event.looked_up_at else None,
    }


def latest_event(session: Session, e164: str) -> Optional[LookupEvent]:
    return session.exec(
        select(LookupEvent)
        .where(LookupEvent.phone_number == e164)
        .order_by(LookupEvent.looked_up_at.desc(), LookupEvent.id.desc())
    ).first()


# ---------- Routes ----------

@app.post("/users/register", summary="Register a new user")
def register_user(payload: RegisterUserRequest, session: Session = Depends(get_session)):
    try:
        e164 = normalize(payload.phone_number, payload.default_region)
    except InvalidPhoneNumber as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    existing = session.exec(select(User).where(User.phone_number == e164)).first()
    if existing:
        raise HTTPException(status_code=409, detail="Phone number already registered")

    user = User(phone_number=e164, display_name=payload.display_name)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@app.post("/contacts/upload", summary="Bulk-upload a user's contacts")
def upload_contacts(payload: UploadContactsRequest, session: Session = Depends(get_session)):
    owner = session.get(User, payload.owner_id)
    if not owner:
        raise HTTPException(status_code=404, detail="Owner user not found")

    saved, skipped = [], []
    for c in payload.contacts:
        try:
            e164 = normalize(c.phone_number, payload.default_region)
        except InvalidPhoneNumber:
            skipped.append(c.phone_number)
            continue
        contact = Contact(owner_id=owner.id, saved_name=c.saved_name, phone_number=e164)
        session.add(contact)
        saved.append({"saved_name": c.saved_name, "phone_number": e164})

    session.commit()
    return {"saved_count": len(saved), "saved": saved, "skipped_invalid": skipped}


@app.get("/lookup/{phone_number}", summary="Caller ID lookup for a number")
def lookup_number(
    phone_number: str,
    default_region: str = Query(default="NG"),
    session: Session = Depends(get_session),
):
    try:
        e164 = normalize(phone_number, default_region)
    except InvalidPhoneNumber as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    contacts = session.exec(select(Contact).where(Contact.phone_number == e164)).all()
    name_counts = Counter(c.saved_name for c in contacts)
    best_name, best_count = (name_counts.most_common(1) or [(None, 0)])[0]

    reports = session.exec(select(SpamReport).where(SpamReport.phone_number == e164)).all()
    category_counts = Counter(r.category for r in reports)

    meta = number_metadata(e164)
    previous = latest_event(session, e164)
    event = record_lookup(session, e164, meta, "lookup")
    session.commit()
    session.refresh(event)

    return {
        **meta,
        "likely_name": best_name,
        "name_agreement_count": best_count,
        "total_contact_saves": len(contacts),
        "spam_report_count": len(reports),
        "spam_categories": dict(category_counts),
        "is_likely_spam": len(reports) >= 5,  # simple crowdsourced threshold
        "latest_location": serialize_event(event),
        "previous_location": serialize_event(previous) if previous else None,
    }


@app.get("/search", summary="Search saved contacts by name")
def search_by_name(
    name: str = Query(..., min_length=1),
    session: Session = Depends(get_session),
):
    results = session.exec(
        select(Contact).where(Contact.saved_name.ilike(f"%{name}%"))
    ).all()

    grouped: dict[str, Counter] = {}
    for c in results:
        grouped.setdefault(c.phone_number, Counter())[c.saved_name] += 1

    payload = []
    for number, names in grouped.items():
        meta = number_metadata(number)
        previous = latest_event(session, number)
        event = record_lookup(session, number, meta, "search")
        payload.append(
            {
                "phone_number": number,
                "likely_name": names.most_common(1)[0][0],
                "name_agreement_count": names.most_common(1)[0][1],
                "variants": dict(names),
                **{k: meta[k] for k in ("region_hint", "carrier_hint", "line_type", "timezones")},
                "latest_location": serialize_event(event),
                "previous_location": serialize_event(previous) if previous else None,
            }
        )

    session.commit()
    return payload


@app.post("/spam/report", summary="Report a number as spam/scam/telemarketer")
def report_spam(payload: SpamReportRequest, session: Session = Depends(get_session)):
    reporter = session.get(User, payload.reporter_id)
    if not reporter:
        raise HTTPException(status_code=404, detail="Reporter user not found")

    try:
        e164 = normalize(payload.phone_number, payload.default_region)
    except InvalidPhoneNumber as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    report = SpamReport(phone_number=e164, reporter_id=reporter.id, category=payload.category)
    session.add(report)
    session.commit()
    session.refresh(report)
    return report


@app.get("/locations/{phone_number}", summary="Latest stored numbering-plan location for a number")
def get_latest_location(
    phone_number: str,
    default_region: str = Query(default="NG"),
    history_limit: int = Query(default=10, ge=1, le=50),
    session: Session = Depends(get_session),
):
    try:
        e164 = normalize(phone_number, default_region)
    except InvalidPhoneNumber as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    events = session.exec(
        select(LookupEvent)
        .where(LookupEvent.phone_number == e164)
        .order_by(LookupEvent.looked_up_at.desc(), LookupEvent.id.desc())
        .limit(history_limit)
    ).all()

    if not events:
        raise HTTPException(
            status_code=404,
            detail="No stored location yet - look up or search this number first.",
        )

    latest = events[0]
    return {
        "e164": e164,
        "latest_location": serialize_event(latest),
        "history": [serialize_event(e) for e in events],
    }
