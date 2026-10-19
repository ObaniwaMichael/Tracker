"""
Phone number parsing/validation + public numbering-plan metadata.

Everything here is derived from libphonenumber's static data tables
(how phone numbering plans are structured per country/carrier block).
It is NOT live location tracking — it cannot tell you where a device
is right now, only what region/carrier a number was originally
registered to, same as looking up an IP's ASN.
"""
from typing import Optional

import phonenumbers
from phonenumbers import NumberParseException, carrier, geocoder, timezone


class InvalidPhoneNumber(Exception):
    pass


def normalize(raw_number: str, default_region: Optional[str] = "NG") -> str:
    """
    Parse a phone number (ideally already in +<countrycode> form) and
    return it in canonical E.164 format, e.g. '+2348012345678'.

    default_region is used only when the input has no leading '+' /
    country code, so callers in Nigeria can type local-format numbers.
    """
    try:
        parsed = phonenumbers.parse(raw_number, default_region)
    except NumberParseException as exc:
        raise InvalidPhoneNumber(str(exc)) from exc

    if not phonenumbers.is_valid_number(parsed):
        raise InvalidPhoneNumber(f"'{raw_number}' is not a valid phone number")

    return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)


def number_metadata(e164_number: str) -> dict:
    """
    Public numbering-plan metadata for an already-normalized E.164 number:
    registration region, carrier/network, line type, and timezone(s)
    associated with that numbering range.
    """
    parsed = phonenumbers.parse(e164_number, None)

    return {
        "e164": e164_number,
        "country_code": parsed.country_code,
        "region_hint": geocoder.description_for_number(parsed, "en"),
        "carrier_hint": carrier.name_for_number(parsed, "en") or "Unknown",
        "line_type": _line_type_name(phonenumbers.number_type(parsed)),
        "timezones": list(timezone.time_zones_for_number(parsed)),
        "is_valid": phonenumbers.is_valid_number(parsed),
    }


def _line_type_name(number_type: int) -> str:
    names = {
        phonenumbers.PhoneNumberType.MOBILE: "mobile",
        phonenumbers.PhoneNumberType.FIXED_LINE: "fixed_line",
        phonenumbers.PhoneNumberType.FIXED_LINE_OR_MOBILE: "fixed_line_or_mobile",
        phonenumbers.PhoneNumberType.TOLL_FREE: "toll_free",
        phonenumbers.PhoneNumberType.PREMIUM_RATE: "premium_rate",
        phonenumbers.PhoneNumberType.VOIP: "voip",
        phonenumbers.PhoneNumberType.PERSONAL_NUMBER: "personal_number",
        phonenumbers.PhoneNumberType.PAGER: "pager",
        phonenumbers.PhoneNumberType.UAN: "uan",
        phonenumbers.PhoneNumberType.UNKNOWN: "unknown",
    }
    return names.get(number_type, "unknown")
