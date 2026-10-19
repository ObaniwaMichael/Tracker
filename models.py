"""
Database models for the Truecaller-style caller ID service.

Design notes:
- We never store or compute live GPS/cell-tower location. `region_hint`
  comes from libphonenumber's numbering-plan data (i.e. "this prefix is
  registered to Lagos, Nigeria"), the same kind of info you'd get from a
  WHOIS-style lookup — not where the phone physically is right now.
- "Caller ID" works by crowdsourcing: each user who uploads their contacts
  contributes (name, number) pairs. When someone searches a number, we
  return the most common name other users have saved for it.
"""
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    """An app user, identified by their own verified phone number."""
    id: Optional[int] = Field(default=None, primary_key=True)
    phone_number: str = Field(index=True, unique=True)  # E.164 format, e.g. +2348012345678
    display_name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Contact(SQLModel, table=True):
    """
    One row = one user's saved name for one phone number.
    This is the crowdsourced data that powers caller ID lookups.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="user.id", index=True)  # who uploaded this
    saved_name: str                                            # what they named it
    phone_number: str = Field(index=True)                      # E.164 format
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SpamReport(SQLModel, table=True):
    """A user flagging a number as spam/scam/telemarketer."""
    id: Optional[int] = Field(default=None, primary_key=True)
    phone_number: str = Field(index=True)
    reporter_id: int = Field(foreign_key="user.id")
    category: str = Field(default="spam")  # spam, scam, telemarketer, fraud
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class LookupEvent(SQLModel, table=True):
    """
    Snapshot of numbering-plan location taken each time a number is looked up
    or appears in a name search. Not live GPS — region/carrier from
    libphonenumber at search time.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    phone_number: str = Field(index=True)
    region_hint: str = Field(default="")
    carrier_hint: str = Field(default="")
    line_type: str = Field(default="")
    source: str = Field(default="lookup")  # lookup | search
    looked_up_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)
