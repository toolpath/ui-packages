from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.turning_axis_kind import TurningAxisKind

if TYPE_CHECKING:
    from ..models.vec_3 import Vec3


T = TypeVar("T", bound="TurningAxis")


@_attrs_define
class TurningAxis:
    """
    Attributes:
        kind (TurningAxisKind): Discriminator identifying a part with a turning axis.
        direction (Vec3):
        location (Vec3):
        area_fraction (float): Fraction of the part’s surface area a turning setup about this axis could finish, from 0
            to 1 — the area lying on the part’s envelope of revolution within tolerance.
        volume_fraction (float): Fraction of the part’s envelope of revolution — what comes off the lathe — that the
            part keeps, from 0 to 1. The rest is what a turning setup leaves to be cut away some other way, so a radially
            unbalanced part scores low here however much of its surface lies on the envelope.
    """

    kind: TurningAxisKind
    direction: Vec3
    location: Vec3
    area_fraction: float
    volume_fraction: float
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        kind = self.kind.value

        direction = self.direction.to_dict()

        location = self.location.to_dict()

        area_fraction = self.area_fraction

        volume_fraction = self.volume_fraction

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "kind": kind,
                "direction": direction,
                "location": location,
                "areaFraction": area_fraction,
                "volumeFraction": volume_fraction,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.vec_3 import Vec3

        d = dict(src_dict)
        kind = TurningAxisKind(d.pop("kind"))

        direction = Vec3.from_dict(d.pop("direction"))

        location = Vec3.from_dict(d.pop("location"))

        area_fraction = d.pop("areaFraction")

        volume_fraction = d.pop("volumeFraction")

        turning_axis = cls(
            kind=kind,
            direction=direction,
            location=location,
            area_fraction=area_fraction,
            volume_fraction=volume_fraction,
        )

        turning_axis.additional_properties = d
        return turning_axis

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
