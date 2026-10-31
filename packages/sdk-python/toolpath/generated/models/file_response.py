from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.file_body import FileBody
    from ..models.file_shape import FileShape


T = TypeVar("T", bound="FileResponse")


@_attrs_define
class FileResponse:
    """
    Attributes:
        file_id (UUID): Identifier of this file.
        filename (str): The name the file was uploaded under.
        created_at (datetime.datetime): Time at which the file was created, in ISO 8601 format.
        bodies (list[FileBody]): The file’s solid bodies, by `index`. Empty until an inspection has succeeded, and never
            changed after it: a file is inspected once, so an `index` names the same body for the life of the file.
        shapes (list[FileShape]): **Experimental.** Available now and still gaining functionality. It may change in
            breaking ways in a minor API release; each such change is listed in the release notes, so check them before
            upgrading.

            The file’s distinct shapes, by the `index` of each one’s first body: separate copies of one shape are one entry,
            with a `count`. Empty until an inspection has succeeded.
        has_mesh (bool): Whether the inspection stored a display mesh of the bodies, served by **Get file mesh** (`GET
            /v1/files/{id}/mesh`). False before inspection, and after one whose meshing failed: meshing is best-effort, and
            the bodies are listed either way.
        inspect_job_id (None | UUID): Identifier of the inspection job that listed `bodies`, or null until one has
            succeeded.
    """

    file_id: UUID
    filename: str
    created_at: datetime.datetime
    bodies: list[FileBody]
    shapes: list[FileShape]
    has_mesh: bool
    inspect_job_id: None | UUID
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        file_id = str(self.file_id)

        filename = self.filename

        created_at = self.created_at.isoformat()

        bodies = []
        for bodies_item_data in self.bodies:
            bodies_item = bodies_item_data.to_dict()
            bodies.append(bodies_item)

        shapes = []
        for shapes_item_data in self.shapes:
            shapes_item = shapes_item_data.to_dict()
            shapes.append(shapes_item)

        has_mesh = self.has_mesh

        inspect_job_id: None | str
        if isinstance(self.inspect_job_id, UUID):
            inspect_job_id = str(self.inspect_job_id)
        else:
            inspect_job_id = self.inspect_job_id

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "fileId": file_id,
                "filename": filename,
                "createdAt": created_at,
                "bodies": bodies,
                "shapes": shapes,
                "hasMesh": has_mesh,
                "inspectJobId": inspect_job_id,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.file_body import FileBody
        from ..models.file_shape import FileShape

        d = dict(src_dict)
        file_id = UUID(d.pop("fileId"))

        filename = d.pop("filename")

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))

        bodies = []
        _bodies = d.pop("bodies")
        for bodies_item_data in _bodies:
            bodies_item = FileBody.from_dict(bodies_item_data)

            bodies.append(bodies_item)

        shapes = []
        _shapes = d.pop("shapes")
        for shapes_item_data in _shapes:
            shapes_item = FileShape.from_dict(shapes_item_data)

            shapes.append(shapes_item)

        has_mesh = d.pop("hasMesh")

        def _parse_inspect_job_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                inspect_job_id_type_0 = UUID(data)

                return inspect_job_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        inspect_job_id = _parse_inspect_job_id(d.pop("inspectJobId"))

        file_response = cls(
            file_id=file_id,
            filename=filename,
            created_at=created_at,
            bodies=bodies,
            shapes=shapes,
            has_mesh=has_mesh,
            inspect_job_id=inspect_job_id,
        )

        file_response.additional_properties = d
        return file_response

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
