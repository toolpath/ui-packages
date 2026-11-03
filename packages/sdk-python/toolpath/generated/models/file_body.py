from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.file_body_bounding_box import FileBodyBoundingBox


T = TypeVar("T", bound="FileBody")


@_attrs_define
class FileBody:
    """
    Attributes:
        index (int): Where the body is among the file’s solid bodies, from 0: what **Make parts from a file** names it
            by.
        face_count (int): How many faces the body has as loaded.
        bounding_box (FileBodyBoundingBox): A box the body fits in, in mm in the file’s coordinates — not necessarily
            the tightest.
        shape (int): **Experimental.** Available now and still gaining functionality. It may change in breaking ways in
            a minor API release; each such change is listed in the release notes, so check them before upgrading.

            The shape this body is: the `index` of the lowest-indexed body of the file it matches, in any position and
            orientation, and its own `index` when it is the first. Bodies are matched on volume, surface area, face count,
            mass distribution and handedness, not exact geometry, so some different bodies match: a hole pattern rotated on
            a symmetric plate, or a near-symmetric part and its mirror image. One part of a shape can be quoted by its
            `count`.
        name (str | Unset): The body’s name, where the file gives it one.
    """

    index: int
    face_count: int
    bounding_box: FileBodyBoundingBox
    shape: int
    name: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        index = self.index

        face_count = self.face_count

        bounding_box = self.bounding_box.to_dict()

        shape = self.shape

        name = self.name

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "index": index,
                "faceCount": face_count,
                "boundingBox": bounding_box,
                "shape": shape,
            }
        )
        if name is not UNSET:
            field_dict["name"] = name

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.file_body_bounding_box import FileBodyBoundingBox

        d = dict(src_dict)
        index = d.pop("index")

        face_count = d.pop("faceCount")

        bounding_box = FileBodyBoundingBox.from_dict(d.pop("boundingBox"))

        shape = d.pop("shape")

        name = d.pop("name", UNSET)

        file_body = cls(
            index=index,
            face_count=face_count,
            bounding_box=bounding_box,
            shape=shape,
            name=name,
        )

        file_body.additional_properties = d
        return file_body

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
