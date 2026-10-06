from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Literal, TypeVar, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.cd_data import CdData


T = TypeVar("T", bound="DovetailFacts")


@_attrs_define
class DovetailFacts:
    """A dovetail groove: overhanging walls leaning back at one angle over a floor, so the
    space widens with depth and a tool has to enter through an opening narrower than where
    it cuts.

    That inversion is why this carries widths rather than a medial-axis measurement. All
    three are clearance diameters read at their own heights, with `0.0` standing for a
    measurement that failed — which is what `cd.measurementFailed` reports.

        Attributes:
            kind (Literal['Dovetail']): Discriminator for this facts variant.
            taper_deg (float): Between the overhanging wall and the tool axis, degrees, positive however the
                wall leans.
            fillet_radius (float): Radius of the blend between wall and floor; 0.0 for the sharp kind.
            floor_width (float): The widest clearance over the floor — the width the groove cuts at.
            is_external (bool): The groove's inner clearances vary from place to place — it runs out somewhere —
                rather than being the one constant width a closed internal dovetail has.
            cd (CdData): Clearance-diameter bounds per tolerance regime, plus the flags derived with them.
            is_invalid_geometry (bool): Deprecated: a width could not be measured at all, so no tool is offered on the
                strength of `cd`. tp-kernel 0.16.0 reports that as `cd.measurementFailed`, which a feature enriched since reads
                here. Removed in the next API major.
            top_opening_width (float | Unset): The clearance through the opening at the top of the groove; absent where
                nothing
                closes the opening there, so no width is too wide.
            bottom_opening_width (float | Unset): The clearance just above the floor, under the overhangs; absent where
                nothing closes
                the opening there, so no width is too wide.
    """

    kind: Literal["Dovetail"]
    taper_deg: float
    fillet_radius: float
    floor_width: float
    is_external: bool
    cd: CdData
    is_invalid_geometry: bool
    top_opening_width: float | Unset = UNSET
    bottom_opening_width: float | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        kind = self.kind

        taper_deg = self.taper_deg

        fillet_radius = self.fillet_radius

        floor_width = self.floor_width

        is_external = self.is_external

        cd = self.cd.to_dict()

        is_invalid_geometry = self.is_invalid_geometry

        top_opening_width = self.top_opening_width

        bottom_opening_width = self.bottom_opening_width

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "kind": kind,
                "taperDeg": taper_deg,
                "filletRadius": fillet_radius,
                "floorWidth": floor_width,
                "isExternal": is_external,
                "cd": cd,
                "isInvalidGeometry": is_invalid_geometry,
            }
        )
        if top_opening_width is not UNSET:
            field_dict["topOpeningWidth"] = top_opening_width
        if bottom_opening_width is not UNSET:
            field_dict["bottomOpeningWidth"] = bottom_opening_width

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.cd_data import CdData

        d = dict(src_dict)
        kind = cast(Literal["Dovetail"], d.pop("kind"))
        if kind != "Dovetail":
            raise ValueError(f"kind must match const 'Dovetail', got '{kind}'")

        taper_deg = d.pop("taperDeg")

        fillet_radius = d.pop("filletRadius")

        floor_width = d.pop("floorWidth")

        is_external = d.pop("isExternal")

        cd = CdData.from_dict(d.pop("cd"))

        is_invalid_geometry = d.pop("isInvalidGeometry")

        top_opening_width = d.pop("topOpeningWidth", UNSET)

        bottom_opening_width = d.pop("bottomOpeningWidth", UNSET)

        dovetail_facts = cls(
            kind=kind,
            taper_deg=taper_deg,
            fillet_radius=fillet_radius,
            floor_width=floor_width,
            is_external=is_external,
            cd=cd,
            is_invalid_geometry=is_invalid_geometry,
            top_opening_width=top_opening_width,
            bottom_opening_width=bottom_opening_width,
        )

        return dovetail_facts
