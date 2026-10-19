from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.turning_below_threshold_kind import TurningBelowThresholdKind

if TYPE_CHECKING:
    from ..models.turning_frame import TurningFrame


T = TypeVar("T", bound="TurningBelowThreshold")


@_attrs_define
class TurningBelowThreshold:
    """An axis was found, but the part’s turnability is under the default threshold.

    Attributes:
        kind (TurningBelowThresholdKind): Discriminator: the axis was found but scored too low.
        axis (TurningFrame): The half-plane a part is turned in: the axis, and how `(z, r)` lies in part coordinates —
            the point `location + z·direction + r·radial`.
        turnability (float): The part’s turnability about the axis found, from 0 to 1. Measured where the part was spun;
            where an estimate already fell well short of the threshold, that estimate, which reads low by at most a few
            hundredths.
    """

    kind: TurningBelowThresholdKind
    axis: TurningFrame
    turnability: float
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        kind = self.kind.value

        axis = self.axis.to_dict()

        turnability = self.turnability

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "kind": kind,
                "axis": axis,
                "turnability": turnability,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.turning_frame import TurningFrame

        d = dict(src_dict)
        kind = TurningBelowThresholdKind(d.pop("kind"))

        axis = TurningFrame.from_dict(d.pop("axis"))

        turnability = d.pop("turnability")

        turning_below_threshold = cls(
            kind=kind,
            axis=axis,
            turnability=turnability,
        )

        turning_below_threshold.additional_properties = d
        return turning_below_threshold

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
