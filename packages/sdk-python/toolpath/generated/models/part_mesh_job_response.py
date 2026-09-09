from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.part_mesh_job_response_status import PartMeshJobResponseStatus

T = TypeVar("T", bound="PartMeshJobResponse")


@_attrs_define
class PartMeshJobResponse:
    """
    Attributes:
        job_id (UUID): Identifier of the queued tessellation job.
        part_id (UUID): Identifier of the part submitted for tessellation.
        status (PartMeshJobResponseStatus): Initial state of the accepted tessellation job.
    """

    job_id: UUID
    part_id: UUID
    status: PartMeshJobResponseStatus
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        job_id = str(self.job_id)

        part_id = str(self.part_id)

        status = self.status.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "jobId": job_id,
                "partId": part_id,
                "status": status,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        job_id = UUID(d.pop("jobId"))

        part_id = UUID(d.pop("partId"))

        status = PartMeshJobResponseStatus(d.pop("status"))

        part_mesh_job_response = cls(
            job_id=job_id,
            part_id=part_id,
            status=status,
        )

        part_mesh_job_response.additional_properties = d
        return part_mesh_job_response

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
