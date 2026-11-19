from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.insert_tool_type import InsertToolType
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.cone import Cone
    from ..models.insert_tool_body import InsertToolBody
    from ..models.insert_tool_insert import InsertToolInsert


T = TypeVar("T", bound="InsertTool")


@_attrs_define
class InsertTool:
    """**Experimental.** Available now and still gaining functionality. It may change in breaking ways in a minor API
    release; each such change is listed in the release notes, so check them before upgrading.

    A tool that cuts with indexable inserts on a body, its arbor the `shaft` above it.

        Attributes:
            type_ (InsertToolType): A tool that cuts with indexable inserts on a body.
            kind (str): What the tool is. Known values: `FlatEndmill`, `RadiusEndmill`, `BallEndmill`, `FaceEndmill`,
                `ChamferEndmill`, `Countersink`, `CornerRoundingMill`, `DrillBit`, `SpotDrill`, `ThreadMill`, `CuttingTap`,
                `FormingTap`, `KeyseatCutter`, `DovetailCutter`, `TaperedEndmill`, `LollipopMill`, `CircleSegmentBarrel`,
                `CircleSegmentLens`, `CircleSegmentOval`, `CircleSegmentTaper`, `BoringBar`, `Counterbore`, `CenterDrill`,
                `Reamer`. Other values may be added.
            name (str): What the tool is called.
            body (InsertToolBody): The body the inserts sit on.
            insert (InsertToolInsert): The inserts, as far as the source states them.
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
            hand (str | Unset): The hand of cut, the way the flutes turn; absent is nobody having said. A tap’s thread hand
                is `thread.handedness`, which the kernel reads. Known values: `right`, `left`. Other values may be added.
            coolant_through (bool | Unset): Whether coolant runs through the tool.
            substrate (str | Unset): The cutting material, in the manufacturer’s own word: `carbide`, `hss`.
            material_groups (list[str] | Unset): The ISO 513 workpiece groups the manufacturer says it cuts. Known values:
                `P`, `M`, `K`, `N`, `S`, `H`. Other values may be added.
            shaft (list[Cone] | Unset): The body above the flutes to the end of the tool, tip end first, as the kernel
                stacks it; absent is not stated. Its top layer is the shank a holder clamps.
    """

    type_: InsertToolType
    kind: str
    name: str
    body: InsertToolBody
    insert: InsertToolInsert
    guid: str | Unset = UNSET
    vendor: str | Unset = UNSET
    product_id: str | Unset = UNSET
    order_number: str | Unset = UNSET
    product_line: str | Unset = UNSET
    product_link: str | Unset = UNSET
    description: str | Unset = UNSET
    unit_system: str | Unset = UNSET
    hand: str | Unset = UNSET
    coolant_through: bool | Unset = UNSET
    substrate: str | Unset = UNSET
    material_groups: list[str] | Unset = UNSET
    shaft: list[Cone] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_.value

        kind = self.kind

        name = self.name

        body = self.body.to_dict()

        insert = self.insert.to_dict()

        guid = self.guid

        vendor = self.vendor

        product_id = self.product_id

        order_number = self.order_number

        product_line = self.product_line

        product_link = self.product_link

        description = self.description

        unit_system = self.unit_system

        hand = self.hand

        coolant_through = self.coolant_through

        substrate = self.substrate

        material_groups: list[str] | Unset = UNSET
        if not isinstance(self.material_groups, Unset):
            material_groups = self.material_groups

        shaft: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.shaft, Unset):
            shaft = []
            for shaft_item_data in self.shaft:
                shaft_item = shaft_item_data.to_dict()
                shaft.append(shaft_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "type": type_,
                "kind": kind,
                "name": name,
                "body": body,
                "insert": insert,
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
        if hand is not UNSET:
            field_dict["hand"] = hand
        if coolant_through is not UNSET:
            field_dict["coolantThrough"] = coolant_through
        if substrate is not UNSET:
            field_dict["substrate"] = substrate
        if material_groups is not UNSET:
            field_dict["materialGroups"] = material_groups
        if shaft is not UNSET:
            field_dict["shaft"] = shaft

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.cone import Cone
        from ..models.insert_tool_body import InsertToolBody
        from ..models.insert_tool_insert import InsertToolInsert

        d = dict(src_dict)
        type_ = InsertToolType(d.pop("type"))

        kind = d.pop("kind")

        name = d.pop("name")

        body = InsertToolBody.from_dict(d.pop("body"))

        insert = InsertToolInsert.from_dict(d.pop("insert"))

        guid = d.pop("guid", UNSET)

        vendor = d.pop("vendor", UNSET)

        product_id = d.pop("productId", UNSET)

        order_number = d.pop("orderNumber", UNSET)

        product_line = d.pop("productLine", UNSET)

        product_link = d.pop("productLink", UNSET)

        description = d.pop("description", UNSET)

        unit_system = d.pop("unitSystem", UNSET)

        hand = d.pop("hand", UNSET)

        coolant_through = d.pop("coolantThrough", UNSET)

        substrate = d.pop("substrate", UNSET)

        material_groups = cast(list[str], d.pop("materialGroups", UNSET))

        _shaft = d.pop("shaft", UNSET)
        shaft: list[Cone] | Unset = UNSET
        if _shaft is not UNSET:
            shaft = []
            for shaft_item_data in _shaft:
                shaft_item = Cone.from_dict(shaft_item_data)

                shaft.append(shaft_item)

        insert_tool = cls(
            type_=type_,
            kind=kind,
            name=name,
            body=body,
            insert=insert,
            guid=guid,
            vendor=vendor,
            product_id=product_id,
            order_number=order_number,
            product_line=product_line,
            product_link=product_link,
            description=description,
            unit_system=unit_system,
            hand=hand,
            coolant_through=coolant_through,
            substrate=substrate,
            material_groups=material_groups,
            shaft=shaft,
        )

        insert_tool.additional_properties = d
        return insert_tool

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
