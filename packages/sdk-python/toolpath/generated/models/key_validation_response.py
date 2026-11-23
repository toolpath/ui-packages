from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.key_validation_response_status import KeyValidationResponseStatus
from ..types import UNSET, Unset

T = TypeVar("T", bound="KeyValidationResponse")


@_attrs_define
class KeyValidationResponse:
    """
    Attributes:
        valid (bool): Whether the key is usable right now. Example: True.
        status (KeyValidationResponseStatus): The derived key status: active (usable), revoked (disabled), expired (past
            expiry), or invalid (unknown key). Example: active.
        org_id (UUID | Unset): **Experimental.** Available now and still gaining functionality. It may change in
            breaking ways in a minor API release; each such change is listed in the release notes, so check them before
            upgrading.

            The Toolpath organization that owns this key. Stable across key rotation and regeneration. Present only when the
            key is active. Example: 00000000-0000-4000-8000-000000000001.
        key_id (UUID | Unset): **Experimental.** Available now and still gaining functionality. It may change in
            breaking ways in a minor API release; each such change is listed in the release notes, so check them before
            upgrading.

            The stable id of this key, unchanged when its secret is regenerated. Present only when the key is active.
            Example: 00000000-0000-4000-8000-000000000002.
        key_prefix (str | Unset): **Experimental.** Available now and still gaining functionality. It may change in
            breaking ways in a minor API release; each such change is listed in the release notes, so check them before
            upgrading.

            The non-secret leading characters of the key, as Portal lists it. They change when its secret is regenerated:
            identify a key by `keyId`. Present only when the key is active. Example: tp_xxxxxxxx.
    """

    valid: bool
    status: KeyValidationResponseStatus
    org_id: UUID | Unset = UNSET
    key_id: UUID | Unset = UNSET
    key_prefix: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        valid = self.valid

        status = self.status.value

        org_id: str | Unset = UNSET
        if not isinstance(self.org_id, Unset):
            org_id = str(self.org_id)

        key_id: str | Unset = UNSET
        if not isinstance(self.key_id, Unset):
            key_id = str(self.key_id)

        key_prefix = self.key_prefix

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "valid": valid,
                "status": status,
            }
        )
        if org_id is not UNSET:
            field_dict["orgId"] = org_id
        if key_id is not UNSET:
            field_dict["keyId"] = key_id
        if key_prefix is not UNSET:
            field_dict["keyPrefix"] = key_prefix

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        valid = d.pop("valid")

        status = KeyValidationResponseStatus(d.pop("status"))

        _org_id = d.pop("orgId", UNSET)
        org_id: UUID | Unset
        if isinstance(_org_id, Unset):
            org_id = UNSET
        else:
            org_id = UUID(_org_id)

        _key_id = d.pop("keyId", UNSET)
        key_id: UUID | Unset
        if isinstance(_key_id, Unset):
            key_id = UNSET
        else:
            key_id = UUID(_key_id)

        key_prefix = d.pop("keyPrefix", UNSET)

        key_validation_response = cls(
            valid=valid,
            status=status,
            org_id=org_id,
            key_id=key_id,
            key_prefix=key_prefix,
        )

        key_validation_response.additional_properties = d
        return key_validation_response

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
