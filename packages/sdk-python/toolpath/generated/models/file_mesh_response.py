from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="FileMeshResponse")


@_attrs_define
class FileMeshResponse:
    """
    Attributes:
        file_id (UUID): Identifier of this file.
        job_id (UUID): Identifier of the inspection job that produced this display mesh.
        mesh_glb_url (str): 15-minute URL for the display mesh of every body as binary glTF (GLB), one node per body.
    """

    file_id: UUID
    job_id: UUID
    mesh_glb_url: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        file_id = str(self.file_id)

        job_id = str(self.job_id)

        mesh_glb_url = self.mesh_glb_url

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "fileId": file_id,
                "jobId": job_id,
                "meshGlbUrl": mesh_glb_url,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        file_id = UUID(d.pop("fileId"))

        job_id = UUID(d.pop("jobId"))

        mesh_glb_url = d.pop("meshGlbUrl")

        file_mesh_response = cls(
            file_id=file_id,
            job_id=job_id,
            mesh_glb_url=mesh_glb_url,
        )

        file_mesh_response.additional_properties = d
        return file_mesh_response

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
