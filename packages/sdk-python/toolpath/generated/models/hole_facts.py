from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Literal, TypeVar, cast

from attrs import define as _attrs_define

from ..models.hole_process import HoleProcess
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.cd_data import CdData
    from ..models.threading import Threading


T = TypeVar("T", bound="HoleFacts")


@_attrs_define
class HoleFacts:
    """A hole's facts. See `HoleFacts` in the `api` crate for what each figure means.

    Attributes:
        kind (Literal['Hole']): Discriminator for this facts variant.
        diameter (float): What the hole is actually drilled to — narrower than modelled for a threaded
            hole.
        full_cone_deg (float): Full apex angle of the cone at the hole bottom, degrees; 180 for a flat bottom.
        is_counterbore (bool): Whether the hole includes a larger counterbore at its mouth.
        hole_process (HoleProcess): How the user wants a hole machined.
        cd (CdData): Clearance-diameter bounds per tolerance regime, plus the flags derived with them.
        max_spot_diameter (float): Largest spot-drill diameter that reaches the hole without collision, in mm.
        max_drill_diameter (float): Largest drill diameter that leaves the hole within its permitted oversize, in mm.
        max_endmill_diameter (float): Largest end-mill diameter that can machine the hole, in mm.
        fillet_radius (float): Radius of the blend at the hole bottom, in mm; zero when sharp.
        fillet_height (float): Height of the bottom blend, in mm; zero when sharp.
        threading (Threading | Unset): A thread a hole is to receive, and how it is to be cut.
        min_drill_diameter (float | Unset): Smallest drill diameter that leaves the hole within its permitted undersize,
            in mm.
    """

    kind: Literal["Hole"]
    diameter: float
    full_cone_deg: float
    is_counterbore: bool
    hole_process: HoleProcess
    cd: CdData
    max_spot_diameter: float
    max_drill_diameter: float
    max_endmill_diameter: float
    fillet_radius: float
    fillet_height: float
    threading: Threading | Unset = UNSET
    min_drill_diameter: float | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        kind = self.kind

        diameter = self.diameter

        full_cone_deg = self.full_cone_deg

        is_counterbore = self.is_counterbore

        hole_process = self.hole_process.value

        cd = self.cd.to_dict()

        max_spot_diameter = self.max_spot_diameter

        max_drill_diameter = self.max_drill_diameter

        max_endmill_diameter = self.max_endmill_diameter

        fillet_radius = self.fillet_radius

        fillet_height = self.fillet_height

        threading: dict[str, Any] | Unset = UNSET
        if not isinstance(self.threading, Unset):
            threading = self.threading.to_dict()

        min_drill_diameter = self.min_drill_diameter

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "kind": kind,
                "diameter": diameter,
                "fullConeDeg": full_cone_deg,
                "isCounterbore": is_counterbore,
                "holeProcess": hole_process,
                "cd": cd,
                "maxSpotDiameter": max_spot_diameter,
                "maxDrillDiameter": max_drill_diameter,
                "maxEndmillDiameter": max_endmill_diameter,
                "filletRadius": fillet_radius,
                "filletHeight": fillet_height,
            }
        )
        if threading is not UNSET:
            field_dict["threading"] = threading
        if min_drill_diameter is not UNSET:
            field_dict["minDrillDiameter"] = min_drill_diameter

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.cd_data import CdData
        from ..models.threading import Threading

        d = dict(src_dict)
        kind = cast(Literal["Hole"], d.pop("kind"))
        if kind != "Hole":
            raise ValueError(f"kind must match const 'Hole', got '{kind}'")

        diameter = d.pop("diameter")

        full_cone_deg = d.pop("fullConeDeg")

        is_counterbore = d.pop("isCounterbore")

        hole_process = HoleProcess(d.pop("holeProcess"))

        cd = CdData.from_dict(d.pop("cd"))

        max_spot_diameter = d.pop("maxSpotDiameter")

        max_drill_diameter = d.pop("maxDrillDiameter")

        max_endmill_diameter = d.pop("maxEndmillDiameter")

        fillet_radius = d.pop("filletRadius")

        fillet_height = d.pop("filletHeight")

        _threading = d.pop("threading", UNSET)
        threading: Threading | Unset
        if isinstance(_threading, Unset):
            threading = UNSET
        else:
            threading = Threading.from_dict(_threading)

        min_drill_diameter = d.pop("minDrillDiameter", UNSET)

        hole_facts = cls(
            kind=kind,
            diameter=diameter,
            full_cone_deg=full_cone_deg,
            is_counterbore=is_counterbore,
            hole_process=hole_process,
            cd=cd,
            max_spot_diameter=max_spot_diameter,
            max_drill_diameter=max_drill_diameter,
            max_endmill_diameter=max_endmill_diameter,
            fillet_radius=fillet_radius,
            fillet_height=fillet_height,
            threading=threading,
            min_drill_diameter=min_drill_diameter,
        )

        return hole_facts
