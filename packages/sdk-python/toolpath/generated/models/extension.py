from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.cone import Cone


T = TypeVar("T", bound="Extension")


@_attrs_define
class Extension:
    """**Experimental.** Available now and still gaining functionality. It may change in breaking ways in a minor API
    release; each such change is listed in the release notes, so check them before upgrading.

    A modular extension a cutting head screws onto; what the holder clamps.

        Attributes:
            system_size (str): The modular coupling a cutting head screws in by, such as `DL10`.
            layers (list[Cone]): Its outline over its whole length, head end (tool side) first: a vendor’s reduced neck
                (L2/D2) is the first layer, the shank the rest, the top layer’s top diameter the shank a collet or bore clamps.
                Empty states no shape.
            name (str | Unset): What the extension is called.
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
            shank_form (str | Unset): The shank’s form (ISO 1835): plain, a Weldon flat or a Whistle Notch; absent is nobody
                having said. Known values: `plain`, `weldon`, `whistle-notch`. Other values may be added.
    """

    system_size: str
    layers: list[Cone]
    name: str | Unset = UNSET
    guid: str | Unset = UNSET
    vendor: str | Unset = UNSET
    product_id: str | Unset = UNSET
    order_number: str | Unset = UNSET
    product_line: str | Unset = UNSET
    product_link: str | Unset = UNSET
    description: str | Unset = UNSET
    unit_system: str | Unset = UNSET
    shank_form: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        system_size = self.system_size

        layers = []
        for layers_item_data in self.layers:
            layers_item = layers_item_data.to_dict()
            layers.append(layers_item)

        name = self.name

        guid = self.guid

        vendor = self.vendor

        product_id = self.product_id

        order_number = self.order_number

        product_line = self.product_line

        product_link = self.product_link

        description = self.description

        unit_system = self.unit_system

        shank_form = self.shank_form

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "systemSize": system_size,
                "layers": layers,
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
        if shank_form is not UNSET:
            field_dict["shankForm"] = shank_form

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.cone import Cone

        d = dict(src_dict)
        system_size = d.pop("systemSize")

        layers = []
        _layers = d.pop("layers")
        for layers_item_data in _layers:
            layers_item = Cone.from_dict(layers_item_data)

            layers.append(layers_item)

        name = d.pop("name", UNSET)

        guid = d.pop("guid", UNSET)

        vendor = d.pop("vendor", UNSET)

        product_id = d.pop("productId", UNSET)

        order_number = d.pop("orderNumber", UNSET)

        product_line = d.pop("productLine", UNSET)

        product_link = d.pop("productLink", UNSET)

        description = d.pop("description", UNSET)

        unit_system = d.pop("unitSystem", UNSET)

        shank_form = d.pop("shankForm", UNSET)

        extension = cls(
            system_size=system_size,
            layers=layers,
            name=name,
            guid=guid,
            vendor=vendor,
            product_id=product_id,
            order_number=order_number,
            product_line=product_line,
            product_link=product_link,
            description=description,
            unit_system=unit_system,
            shank_form=shank_form,
        )

        extension.additional_properties = d
        return extension

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
