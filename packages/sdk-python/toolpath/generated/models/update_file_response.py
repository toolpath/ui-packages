from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.update_file_response_status import UpdateFileResponseStatus

T = TypeVar("T", bound="UpdateFileResponse")


@_attrs_define
class UpdateFileResponse:
    """
    Attributes:
        job_id (UUID): Identifier of the queued inspection job.
        file_id (UUID): Identifier of the file submitted for inspection.
        status (UpdateFileResponseStatus): Initial state of the accepted inspection job.
    """

    job_id: UUID
    file_id: UUID
    status: UpdateFileResponseStatus
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        job_id = str(self.job_id)

        file_id = str(self.file_id)

        status = self.status.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "jobId": job_id,
                "fileId": file_id,
                "status": status,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        job_id = UUID(d.pop("jobId"))

        file_id = UUID(d.pop("fileId"))

        status = UpdateFileResponseStatus(d.pop("status"))

        update_file_response = cls(
            job_id=job_id,
            file_id=file_id,
            status=status,
        )

        update_file_response.additional_properties = d
        return update_file_response

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
