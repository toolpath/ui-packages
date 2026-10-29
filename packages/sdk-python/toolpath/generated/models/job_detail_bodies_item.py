from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.job_detail_bodies_item_bounding_box import JobDetailBodiesItemBoundingBox


T = TypeVar("T", bound="JobDetailBodiesItem")


@_attrs_define
class JobDetailBodiesItem:
    """
    Attributes:
        index (int): Where the body is among the file’s solid bodies, from 0: pass it as `bodyIndex` to **Upload a
            part** (`POST /v1/parts`) to make a part of this body.
        face_count (int): How many faces the body has as loaded.
        bounding_box (JobDetailBodiesItemBoundingBox): A box the body fits in, in mm in the file’s coordinates — not
            necessarily the tightest.
        name (str | Unset): The body’s name, where the file gives it one.
    """

    index: int
    face_count: int
    bounding_box: JobDetailBodiesItemBoundingBox
    name: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        index = self.index

        face_count = self.face_count

        bounding_box = self.bounding_box.to_dict()

        name = self.name

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "index": index,
                "faceCount": face_count,
                "boundingBox": bounding_box,
            }
        )
        if name is not UNSET:
            field_dict["name"] = name

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.job_detail_bodies_item_bounding_box import JobDetailBodiesItemBoundingBox

        d = dict(src_dict)
        index = d.pop("index")

        face_count = d.pop("faceCount")

        bounding_box = JobDetailBodiesItemBoundingBox.from_dict(d.pop("boundingBox"))

        name = d.pop("name", UNSET)

        job_detail_bodies_item = cls(
            index=index,
            face_count=face_count,
            bounding_box=bounding_box,
            name=name,
        )

        job_detail_bodies_item.additional_properties = d
        return job_detail_bodies_item

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
