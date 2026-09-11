from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="PartMeshResponse")


@_attrs_define
class PartMeshResponse:
    """
    Attributes:
        part_id (UUID): Identifier of this part.
        job_id (UUID): Identifier of the tessellation job that produced this display mesh.
        mesh_point_count (int): Number of points in the display mesh.
        mesh_triangle_count (int): Number of triangles in the display mesh.
        face_triangle_counts (list[int] | None): How many of the mesh’s triangles each face of the body became, in mesh
            order. Every face is one contiguous span of triangles, so the counts partition the mesh and sum to
            `meshTriangleCount`: the first count’s triangles are the first face, the next count’s the second, and so on.
            Draw a line where two spans meet to outline the part. Null for a mesh tessellated before face spans were kept;
            queue a new tessellation to get them.
        mesh_glb_url (str): 15-minute URL for the display mesh as binary glTF (GLB).
    """

    part_id: UUID
    job_id: UUID
    mesh_point_count: int
    mesh_triangle_count: int
    face_triangle_counts: list[int] | None
    mesh_glb_url: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        part_id = str(self.part_id)

        job_id = str(self.job_id)

        mesh_point_count = self.mesh_point_count

        mesh_triangle_count = self.mesh_triangle_count

        face_triangle_counts: list[int] | None
        if isinstance(self.face_triangle_counts, list):
            face_triangle_counts = self.face_triangle_counts

        else:
            face_triangle_counts = self.face_triangle_counts

        mesh_glb_url = self.mesh_glb_url

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "partId": part_id,
                "jobId": job_id,
                "meshPointCount": mesh_point_count,
                "meshTriangleCount": mesh_triangle_count,
                "faceTriangleCounts": face_triangle_counts,
                "meshGlbUrl": mesh_glb_url,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        part_id = UUID(d.pop("partId"))

        job_id = UUID(d.pop("jobId"))

        mesh_point_count = d.pop("meshPointCount")

        mesh_triangle_count = d.pop("meshTriangleCount")

        def _parse_face_triangle_counts(data: object) -> list[int] | None:
            if data is None:
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                face_triangle_counts_type_0 = cast(list[int], data)

                return face_triangle_counts_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[int] | None, data)

        face_triangle_counts = _parse_face_triangle_counts(d.pop("faceTriangleCounts"))

        mesh_glb_url = d.pop("meshGlbUrl")

        part_mesh_response = cls(
            part_id=part_id,
            job_id=job_id,
            mesh_point_count=mesh_point_count,
            mesh_triangle_count=mesh_triangle_count,
            face_triangle_counts=face_triangle_counts,
            mesh_glb_url=mesh_glb_url,
        )

        part_mesh_response.additional_properties = d
        return part_mesh_response

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
