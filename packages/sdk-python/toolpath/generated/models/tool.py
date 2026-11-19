from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.tool_type import ToolType
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.cone import Cone
    from ..models.tool_thread import ToolThread


T = TypeVar("T", bound="Tool")


@_attrs_define
class Tool:
    """**Experimental.** Available now and still gaining functionality. It may change in breaking ways in a minor API
    release; each such change is listed in the release notes, so check them before upgrading.

    A solid cutting tool: one ground body, flutes and the `shaft` above them.

        Attributes:
            type_ (ToolType): A solid tool: one ground body, flutes and shank.
            kind (str): What the tool is. Known values: `FlatEndmill`, `RadiusEndmill`, `BallEndmill`, `FaceEndmill`,
                `ChamferEndmill`, `Countersink`, `CornerRoundingMill`, `DrillBit`, `SpotDrill`, `ThreadMill`, `CuttingTap`,
                `FormingTap`, `KeyseatCutter`, `DovetailCutter`, `TaperedEndmill`, `LollipopMill`, `CircleSegmentBarrel`,
                `CircleSegmentLens`, `CircleSegmentOval`, `CircleSegmentTaper`, `BoringBar`, `Counterbore`, `CenterDrill`,
                `Reamer`. Other values may be added.
            name (str): What the tool is called.
            diameter (float): The cutting head’s largest diameter, mm. For a chamfer mill or countersink, the top of its
                cone, which the flutes may stop short of.
            flute_length (float): Axial length that cuts, from the tip, mm.
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
            drill_depth (float | Unset): A drill’s deepest hole, mm, as its maker states it: short of its flutes, which need
                room to clear chips.
            flute_count (int | Unset): How many flutes it has.
            shaft (list[Cone] | Unset): The body above the flutes to the end of the tool, tip end first, as the kernel
                stacks it; absent is not stated. Its top layer is the shank a holder clamps.
            shank_form (str | Unset): The shank’s form (ISO 1835): plain, a Weldon flat or a Whistle Notch; absent is nobody
                having said. Known values: `plain`, `weldon`, `whistle-notch`. Other values may be added.
            shank_clamp_min (float | Unset): The least of the shank the manufacturer wants clamped, mm (ISO 13399 `LSCN`).
            corner_radius (float | Unset): The round on a bull nose’s corner, or half a ball’s diameter, mm.
            rounding_radius (float | Unset): The round a corner rounding mill cuts, mm.
            tip_angle_deg (float | Unset): Included point angle of a drill, countersink or chamfer mill, degrees.
            tip_diameter (float | Unset): The small end of a chamfer mill’s, countersink’s or spot drill’s cone, mm: 0 for a
                sharp point.
            undercut_reach (float | Unset): How far a keyseat or dovetail cutter’s disc overhangs its neck, mm.
            taper_angle_deg (float | Unset): Angle of a flank to the tool axis, degrees (Fusion’s `TA`): a dovetail’s lean,
                a tapered mill’s taper, a centre drill’s countersink half angle.
            tip_length (float | Unset): Length of the tip below the cutting edge, mm (Fusion’s `tip-length`): a corner
                rounding mill’s pilot below its round, a centre drill’s pilot.
            thread (ToolThread | Unset): The thread a tap or thread mill cuts.
    """

    type_: ToolType
    kind: str
    name: str
    diameter: float
    flute_length: float
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
    drill_depth: float | Unset = UNSET
    flute_count: int | Unset = UNSET
    shaft: list[Cone] | Unset = UNSET
    shank_form: str | Unset = UNSET
    shank_clamp_min: float | Unset = UNSET
    corner_radius: float | Unset = UNSET
    rounding_radius: float | Unset = UNSET
    tip_angle_deg: float | Unset = UNSET
    tip_diameter: float | Unset = UNSET
    undercut_reach: float | Unset = UNSET
    taper_angle_deg: float | Unset = UNSET
    tip_length: float | Unset = UNSET
    thread: ToolThread | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_.value

        kind = self.kind

        name = self.name

        diameter = self.diameter

        flute_length = self.flute_length

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

        drill_depth = self.drill_depth

        flute_count = self.flute_count

        shaft: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.shaft, Unset):
            shaft = []
            for shaft_item_data in self.shaft:
                shaft_item = shaft_item_data.to_dict()
                shaft.append(shaft_item)

        shank_form = self.shank_form

        shank_clamp_min = self.shank_clamp_min

        corner_radius = self.corner_radius

        rounding_radius = self.rounding_radius

        tip_angle_deg = self.tip_angle_deg

        tip_diameter = self.tip_diameter

        undercut_reach = self.undercut_reach

        taper_angle_deg = self.taper_angle_deg

        tip_length = self.tip_length

        thread: dict[str, Any] | Unset = UNSET
        if not isinstance(self.thread, Unset):
            thread = self.thread.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "type": type_,
                "kind": kind,
                "name": name,
                "diameter": diameter,
                "fluteLength": flute_length,
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
        if drill_depth is not UNSET:
            field_dict["drillDepth"] = drill_depth
        if flute_count is not UNSET:
            field_dict["fluteCount"] = flute_count
        if shaft is not UNSET:
            field_dict["shaft"] = shaft
        if shank_form is not UNSET:
            field_dict["shankForm"] = shank_form
        if shank_clamp_min is not UNSET:
            field_dict["shankClampMin"] = shank_clamp_min
        if corner_radius is not UNSET:
            field_dict["cornerRadius"] = corner_radius
        if rounding_radius is not UNSET:
            field_dict["roundingRadius"] = rounding_radius
        if tip_angle_deg is not UNSET:
            field_dict["tipAngleDeg"] = tip_angle_deg
        if tip_diameter is not UNSET:
            field_dict["tipDiameter"] = tip_diameter
        if undercut_reach is not UNSET:
            field_dict["undercutReach"] = undercut_reach
        if taper_angle_deg is not UNSET:
            field_dict["taperAngleDeg"] = taper_angle_deg
        if tip_length is not UNSET:
            field_dict["tipLength"] = tip_length
        if thread is not UNSET:
            field_dict["thread"] = thread

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.cone import Cone
        from ..models.tool_thread import ToolThread

        d = dict(src_dict)
        type_ = ToolType(d.pop("type"))

        kind = d.pop("kind")

        name = d.pop("name")

        diameter = d.pop("diameter")

        flute_length = d.pop("fluteLength")

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

        drill_depth = d.pop("drillDepth", UNSET)

        flute_count = d.pop("fluteCount", UNSET)

        _shaft = d.pop("shaft", UNSET)
        shaft: list[Cone] | Unset = UNSET
        if _shaft is not UNSET:
            shaft = []
            for shaft_item_data in _shaft:
                shaft_item = Cone.from_dict(shaft_item_data)

                shaft.append(shaft_item)

        shank_form = d.pop("shankForm", UNSET)

        shank_clamp_min = d.pop("shankClampMin", UNSET)

        corner_radius = d.pop("cornerRadius", UNSET)

        rounding_radius = d.pop("roundingRadius", UNSET)

        tip_angle_deg = d.pop("tipAngleDeg", UNSET)

        tip_diameter = d.pop("tipDiameter", UNSET)

        undercut_reach = d.pop("undercutReach", UNSET)

        taper_angle_deg = d.pop("taperAngleDeg", UNSET)

        tip_length = d.pop("tipLength", UNSET)

        _thread = d.pop("thread", UNSET)
        thread: ToolThread | Unset
        if isinstance(_thread, Unset):
            thread = UNSET
        else:
            thread = ToolThread.from_dict(_thread)

        tool = cls(
            type_=type_,
            kind=kind,
            name=name,
            diameter=diameter,
            flute_length=flute_length,
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
            drill_depth=drill_depth,
            flute_count=flute_count,
            shaft=shaft,
            shank_form=shank_form,
            shank_clamp_min=shank_clamp_min,
            corner_radius=corner_radius,
            rounding_radius=rounding_radius,
            tip_angle_deg=tip_angle_deg,
            tip_diameter=tip_diameter,
            undercut_reach=undercut_reach,
            taper_angle_deg=taper_angle_deg,
            tip_length=tip_length,
            thread=thread,
        )

        tool.additional_properties = d
        return tool

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
