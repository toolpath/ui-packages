from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="ToolThreadTip")


@_attrs_define
class ToolThreadTip:
    """A thread mill’s tooth tip (Fusion’s `thread-tip-type`), which decides the root of the thread it cuts.

    Attributes:
        form (str): The tip’s form: a `flat` tip states `width`, a `round` one `radius`, and a `point` neither. Known
            values: `point`, `flat`, `round`. Other values may be added.
        width (float | Unset): Its width, mm. A `flat` tip’s.
        radius (float | Unset): Its radius, mm. A `round` tip’s.
    """

    form: str
    width: float | Unset = UNSET
    radius: float | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        form = self.form

        width = self.width

        radius = self.radius

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "form": form,
            }
        )
        if width is not UNSET:
            field_dict["width"] = width
        if radius is not UNSET:
            field_dict["radius"] = radius

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        form = d.pop("form")

        width = d.pop("width", UNSET)

        radius = d.pop("radius", UNSET)

        tool_thread_tip = cls(
            form=form,
            width=width,
            radius=radius,
        )

        tool_thread_tip.additional_properties = d
        return tool_thread_tip

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
