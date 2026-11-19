from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.cone import Cone


T = TypeVar("T", bound="Holder")


@_attrs_define
class Holder:
    """**Experimental.** Available now and still gaining functionality. It may change in breaking ways in a minor API
    release; each such change is listed in the release notes, so check them before upgrading.

    A tool holder as a revolved outline.

        Attributes:
            layers (list[Cone]): The holder’s outline, nose (tool side) layer first.
            gauge_length (float | None): Spindle gauge line to the holder nose, mm; null where it is not known.
            name (str | Unset): What the holder is called.
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
            clamping (str | Unset): How it grips the tool; absent is nobody having said, and takes no tool. Known values:
                `bore`, `collet`, `shrink-fit`, `hydraulic`, `side-lock`, `milling-chuck`. Other values may be added.
            collet_series (str | Unset): For a collet holder, the collet series it takes, such as `ER16`.
            bore_diameter (float | Unset): For a holder that grips in its own bore, the one shank diameter it takes, mm: not
                an upper bound. A sleeve this wide takes the shanks its clamp range covers.
            bore_depth (float | Unset): How deep a shank can go into the bore, mm: a tool sits no deeper.
            clamp_length (float | Unset): Axial length of shank the holder itself grips, mm (the vendor’s `L9`); a collet
                holder’s grip is its collet’s.
            taper (str | Unset): The spindle interface, such as `BT30`: a holder fits only the machine that takes it.
            collet_protrusion (float | Unset): How far the seated collet stands proud of the nose face, mm.
            face_contact (bool | Unset): Whether it seats on the spindle face as well as the taper.
            coolant_through (bool | Unset): Whether coolant runs through it to the tool.
    """

    layers: list[Cone]
    gauge_length: float | None
    name: str | Unset = UNSET
    guid: str | Unset = UNSET
    vendor: str | Unset = UNSET
    product_id: str | Unset = UNSET
    order_number: str | Unset = UNSET
    product_line: str | Unset = UNSET
    product_link: str | Unset = UNSET
    description: str | Unset = UNSET
    unit_system: str | Unset = UNSET
    clamping: str | Unset = UNSET
    collet_series: str | Unset = UNSET
    bore_diameter: float | Unset = UNSET
    bore_depth: float | Unset = UNSET
    clamp_length: float | Unset = UNSET
    taper: str | Unset = UNSET
    collet_protrusion: float | Unset = UNSET
    face_contact: bool | Unset = UNSET
    coolant_through: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        layers = []
        for layers_item_data in self.layers:
            layers_item = layers_item_data.to_dict()
            layers.append(layers_item)

        gauge_length: float | None
        gauge_length = self.gauge_length

        name = self.name

        guid = self.guid

        vendor = self.vendor

        product_id = self.product_id

        order_number = self.order_number

        product_line = self.product_line

        product_link = self.product_link

        description = self.description

        unit_system = self.unit_system

        clamping = self.clamping

        collet_series = self.collet_series

        bore_diameter = self.bore_diameter

        bore_depth = self.bore_depth

        clamp_length = self.clamp_length

        taper = self.taper

        collet_protrusion = self.collet_protrusion

        face_contact = self.face_contact

        coolant_through = self.coolant_through

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "layers": layers,
                "gaugeLength": gauge_length,
            }
        )
        if name is not UNSET:
            field_dict["name"] = name
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
        if clamping is not UNSET:
            field_dict["clamping"] = clamping
        if collet_series is not UNSET:
            field_dict["colletSeries"] = collet_series
        if bore_diameter is not UNSET:
            field_dict["boreDiameter"] = bore_diameter
        if bore_depth is not UNSET:
            field_dict["boreDepth"] = bore_depth
        if clamp_length is not UNSET:
            field_dict["clampLength"] = clamp_length
        if taper is not UNSET:
            field_dict["taper"] = taper
        if collet_protrusion is not UNSET:
            field_dict["colletProtrusion"] = collet_protrusion
        if face_contact is not UNSET:
            field_dict["faceContact"] = face_contact
        if coolant_through is not UNSET:
            field_dict["coolantThrough"] = coolant_through

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.cone import Cone

        d = dict(src_dict)
        layers = []
        _layers = d.pop("layers")
        for layers_item_data in _layers:
            layers_item = Cone.from_dict(layers_item_data)

            layers.append(layers_item)

        def _parse_gauge_length(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        gauge_length = _parse_gauge_length(d.pop("gaugeLength"))

        name = d.pop("name", UNSET)

        guid = d.pop("guid", UNSET)

        vendor = d.pop("vendor", UNSET)

        product_id = d.pop("productId", UNSET)

        order_number = d.pop("orderNumber", UNSET)

        product_line = d.pop("productLine", UNSET)

        product_link = d.pop("productLink", UNSET)

        description = d.pop("description", UNSET)

        unit_system = d.pop("unitSystem", UNSET)

        clamping = d.pop("clamping", UNSET)

        collet_series = d.pop("colletSeries", UNSET)

        bore_diameter = d.pop("boreDiameter", UNSET)

        bore_depth = d.pop("boreDepth", UNSET)

        clamp_length = d.pop("clampLength", UNSET)

        taper = d.pop("taper", UNSET)

        collet_protrusion = d.pop("colletProtrusion", UNSET)

        face_contact = d.pop("faceContact", UNSET)

        coolant_through = d.pop("coolantThrough", UNSET)

        holder = cls(
            layers=layers,
            gauge_length=gauge_length,
            name=name,
            guid=guid,
            vendor=vendor,
            product_id=product_id,
            order_number=order_number,
            product_line=product_line,
            product_link=product_link,
            description=description,
            unit_system=unit_system,
            clamping=clamping,
            collet_series=collet_series,
            bore_diameter=bore_diameter,
            bore_depth=bore_depth,
            clamp_length=clamp_length,
            taper=taper,
            collet_protrusion=collet_protrusion,
            face_contact=face_contact,
            coolant_through=coolant_through,
        )

        holder.additional_properties = d
        return holder

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
