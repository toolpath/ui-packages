from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="ToolLibraryResponse")


@_attrs_define
class ToolLibraryResponse:
    """**Experimental.** Available now and still gaining functionality. It may change in breaking ways in a minor API
    release; each such change is listed in the release notes, so check them before upgrading.

    A Fusion tool library.

        Attributes:
            tool_library_id (UUID): Identifier of this tool library: what a tool crib names it by.
            filename (None | str): The name given for its file when it was created, or null for none.
            created_at (datetime.datetime): When the library was created.
            expires_at (datetime.datetime): When the library stops being served unless a plan or toolpath request naming it
                in its crib extends it first: 15 days after its creation or such a request, to within a day. Such a request
                extends it once it was admitted and its job created, at most once a day, and an idempotent replay does not.
                Reading the library does not.
            download_url (None | str): 15-minute URL for the library’s file as it is stored now, or null while nothing has
                been uploaded to it. A library uploaded again after a job read it is refused by plan requests
                (`tool_library_source_changed`).
    """

    tool_library_id: UUID
    filename: None | str
    created_at: datetime.datetime
    expires_at: datetime.datetime
    download_url: None | str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        tool_library_id = str(self.tool_library_id)

        filename: None | str
        filename = self.filename

        created_at = self.created_at.isoformat()

        expires_at = self.expires_at.isoformat()

        download_url: None | str
        download_url = self.download_url

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "toolLibraryId": tool_library_id,
                "filename": filename,
                "createdAt": created_at,
                "expiresAt": expires_at,
                "downloadUrl": download_url,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        tool_library_id = UUID(d.pop("toolLibraryId"))

        def _parse_filename(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        filename = _parse_filename(d.pop("filename"))

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))

        expires_at = datetime.datetime.fromisoformat(d.pop("expiresAt"))

        def _parse_download_url(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        download_url = _parse_download_url(d.pop("downloadUrl"))

        tool_library_response = cls(
            tool_library_id=tool_library_id,
            filename=filename,
            created_at=created_at,
            expires_at=expires_at,
            download_url=download_url,
        )

        tool_library_response.additional_properties = d
        return tool_library_response

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
