from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.vec_3 import Vec3


T = TypeVar("T", bound="JobDetailBodiesItemBoundingBox")


@_attrs_define
class JobDetailBodiesItemBoundingBox:
    """A box the body fits in, in mm in the file’s coordinates — not necessarily the tightest.

    Attributes:
        lower (Vec3):
        upper (Vec3):
    """

    lower: Vec3
    upper: Vec3
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        lower = self.lower.to_dict()

        upper = self.upper.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "lower": lower,
                "upper": upper,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.vec_3 import Vec3

        d = dict(src_dict)
        lower = Vec3.from_dict(d.pop("lower"))

        upper = Vec3.from_dict(d.pop("upper"))

        job_detail_bodies_item_bounding_box = cls(
            lower=lower,
            upper=upper,
        )

        job_detail_bodies_item_bounding_box.additional_properties = d
        return job_detail_bodies_item_bounding_box

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
