from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any, TypeVar
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="DemoSessionResponse")


@_attrs_define
class DemoSessionResponse:
    """
    Attributes:
        api_key (str): The temporary API key. Shown once; send it as `Authorization: Bearer <key>`. Example:
            tp_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6.
        expires_at (datetime.datetime): When the key stops working (ISO 8601). Prompt the user for a real key before
            then. Example: 2026-09-09T14:30:00.000Z.
        org_id (UUID): The throwaway organization this session’s uploads are isolated to.
    """

    api_key: str
    expires_at: datetime.datetime
    org_id: UUID
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        api_key = self.api_key

        expires_at = self.expires_at.isoformat()

        org_id = str(self.org_id)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "apiKey": api_key,
                "expiresAt": expires_at,
                "orgId": org_id,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        api_key = d.pop("apiKey")

        expires_at = datetime.datetime.fromisoformat(d.pop("expiresAt"))

        org_id = UUID(d.pop("orgId"))

        demo_session_response = cls(
            api_key=api_key,
            expires_at=expires_at,
            org_id=org_id,
        )

        demo_session_response.additional_properties = d
        return demo_session_response

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
