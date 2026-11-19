from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="Collet")


@_attrs_define
class Collet:
    """**Experimental.** Available now and still gaining functionality. It may change in breaking ways in a minor API
    release; each such change is listed in the release notes, so check them before upgrading.

    A collet: what clamps a shank in a collet chuck, or a sleeve in a bore.

        Attributes:
            series (str): The collet series, such as `ER32`; a sleeve’s own series name.
            clamp_min (float): Smallest shank it clamps, mm.
            clamp_max (float): Largest shank it clamps, mm.
            guid (str | Unset): The record’s stable identifier, where the catalog keeps one; a CAM export needs it.
            vendor (str | Unset): The manufacturer, where the source states one.
            product_id (str | Unset): The manufacturer’s part number, where the source states one.
            order_number (str | Unset): The manufacturer’s order number, where it differs from its part number.
            product_line (str | Unset): The manufacturer’s product line or series, where the source states one.
            product_link (str | Unset): Where the manufacturer lists it.
            description (str | Unset): The catalog’s own description, where the source states one.
            unit_system (str | Unset): The system the manufacturer published it in: decides how a number is rounded and
                shown, never the unit it is stored in, which is always mm. Known values: `millimeters`, `inches`. Other values
                may be added.
            kind (str | Unset): What the collet is; absent is nobody having said. Known values: `standard`, `coolant-
                through`, `tap`, `sleeve`. Other values may be added.
            clamp_length (float | Unset): Axial length of shank it grips, mm; absent where unpublished, which leaves no
                honest maximum stickout.
            square_size (float | Unset): The square drive a tap collet grips, across flats, mm: such a collet takes only a
                tap.
            outer_diameter (float | Unset): The bore it sits in, mm; a sleeve states one, and fits a holder bored to it.
    """

    series: str
    clamp_min: float
    clamp_max: float
    guid: str | Unset = UNSET
    vendor: str | Unset = UNSET
    product_id: str | Unset = UNSET
    order_number: str | Unset = UNSET
    product_line: str | Unset = UNSET
    product_link: str | Unset = UNSET
    description: str | Unset = UNSET
    unit_system: str | Unset = UNSET
    kind: str | Unset = UNSET
    clamp_length: float | Unset = UNSET
    square_size: float | Unset = UNSET
    outer_diameter: float | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        series = self.series

        clamp_min = self.clamp_min

        clamp_max = self.clamp_max

        guid = self.guid

        vendor = self.vendor

        product_id = self.product_id

        order_number = self.order_number

        product_line = self.product_line

        product_link = self.product_link

        description = self.description

        unit_system = self.unit_system

        kind = self.kind

        clamp_length = self.clamp_length

        square_size = self.square_size

        outer_diameter = self.outer_diameter

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "series": series,
                "clampMin": clamp_min,
                "clampMax": clamp_max,
            }
        )
        if guid is not UNSET:
            field_dict["guid"] = guid
        if vendor is not UNSET:
            field_dict["vendor"] = vendor
        if product_id is not UNSET:
            field_dict["productId"] = product_id
        if order_number is not UNSET:
            field_dict["orderNumber"] = order_number
        if product_line is not UNSET:
            field_dict["productLine"] = product_line
        if product_link is not UNSET:
            field_dict["productLink"] = product_link
        if description is not UNSET:
            field_dict["description"] = description
        if unit_system is not UNSET:
            field_dict["unitSystem"] = unit_system
        if kind is not UNSET:
            field_dict["kind"] = kind
        if clamp_length is not UNSET:
            field_dict["clampLength"] = clamp_length
        if square_size is not UNSET:
            field_dict["squareSize"] = square_size
        if outer_diameter is not UNSET:
            field_dict["outerDiameter"] = outer_diameter

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        series = d.pop("series")

        clamp_min = d.pop("clampMin")

        clamp_max = d.pop("clampMax")

        guid = d.pop("guid", UNSET)

        vendor = d.pop("vendor", UNSET)

        product_id = d.pop("productId", UNSET)

        order_number = d.pop("orderNumber", UNSET)

        product_line = d.pop("productLine", UNSET)

        product_link = d.pop("productLink", UNSET)

        description = d.pop("description", UNSET)

        unit_system = d.pop("unitSystem", UNSET)

        kind = d.pop("kind", UNSET)

        clamp_length = d.pop("clampLength", UNSET)

        square_size = d.pop("squareSize", UNSET)

        outer_diameter = d.pop("outerDiameter", UNSET)

        collet = cls(
            series=series,
            clamp_min=clamp_min,
            clamp_max=clamp_max,
            guid=guid,
            vendor=vendor,
            product_id=product_id,
            order_number=order_number,
            product_line=product_line,
            product_link=product_link,
            description=description,
            unit_system=unit_system,
            kind=kind,
            clamp_length=clamp_length,
            square_size=square_size,
            outer_diameter=outer_diameter,
        )

        collet.additional_properties = d
        return collet

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
