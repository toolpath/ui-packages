from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="DemoSessionRequest")


@_attrs_define
class DemoSessionRequest:
    """
    Attributes:
        install_id (UUID | Unset): A stable id the caller keeps per install (a UUID). Sending it makes renewals land on
            the same organization, so uploads and usage stay together. Omit it for a fresh throwaway organization each time.
            Example: 2f1c5d0e-6b7a-4c8d-9e0f-1a2b3c4d5e6f.
    """

    install_id: UUID | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        install_id: str | Unset = UNSET
        if not isinstance(self.install_id, Unset):
            install_id = str(self.install_id)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if install_id is not UNSET:
            field_dict["installId"] = install_id

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        _install_id = d.pop("installId", UNSET)
        install_id: UUID | Unset
        if isinstance(_install_id, Unset):
            install_id = UNSET
        else:
            install_id = UUID(_install_id)

        demo_session_request = cls(
            install_id=install_id,
        )

        demo_session_request.additional_properties = d
        return demo_session_request

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
