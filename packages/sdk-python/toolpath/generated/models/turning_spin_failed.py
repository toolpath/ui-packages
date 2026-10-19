from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.axis_source import AxisSource
from ..models.turning_spin_failed_kind import TurningSpinFailedKind

if TYPE_CHECKING:
    from ..models.turning_frame import TurningFrame


T = TypeVar("T", bound="TurningSpinFailed")


@_attrs_define
class TurningSpinFailed:
    """The part could not be spun about its axis, or its outline could not be read.

    Attributes:
        kind (TurningSpinFailedKind): Discriminator: the part could not be read about its axis.
        axis (TurningFrame): The half-plane a part is turned in: the axis, and how `(z, r)` lies in part coordinates —
            the point `location + z·direction + r·radial`.
        axis_source (AxisSource): Where the axis came from: `Detected` is the axis the part’s revolved surfaces agree
            on.
        error (str): What went wrong, for people to read. Its wording may change: branch on `code`.
        code (str): The failure’s category, a stable code to branch on.
    """

    kind: TurningSpinFailedKind
    axis: TurningFrame
    axis_source: AxisSource
    error: str
    code: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        kind = self.kind.value

        axis = self.axis.to_dict()

        axis_source = self.axis_source.value

        error = self.error

        code = self.code

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "kind": kind,
                "axis": axis,
                "axisSource": axis_source,
                "error": error,
                "code": code,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.turning_frame import TurningFrame

        d = dict(src_dict)
        kind = TurningSpinFailedKind(d.pop("kind"))

        axis = TurningFrame.from_dict(d.pop("axis"))

        axis_source = AxisSource(d.pop("axisSource"))

        error = d.pop("error")

        code = d.pop("code")

        turning_spin_failed = cls(
            kind=kind,
            axis=axis,
            axis_source=axis_source,
            error=error,
            code=code,
        )

        turning_spin_failed.additional_properties = d
        return turning_spin_failed

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
