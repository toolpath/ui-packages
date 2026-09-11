from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define

from ..models.feature_type import FeatureType
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.boss_facts import BossFacts
    from ..models.chamfer_facts import ChamferFacts
    from ..models.dovetail_facts import DovetailFacts
    from ..models.face_facts import FaceFacts
    from ..models.hole_facts import HoleFacts
    from ..models.pinch_point import PinchPoint
    from ..models.pocket_facts import PocketFacts
    from ..models.profile_facts import ProfileFacts
    from ..models.reach_curve import ReachCurve
    from ..models.surface_areas import SurfaceAreas
    from ..models.surface_facts import SurfaceFacts
    from ..models.tolerance_band import ToleranceBand
    from ..models.tslot_facts import TslotFacts
    from ..models.wall_facts import WallFacts


T = TypeVar("T", bound="FeatureDatasheet")


@_attrs_define
class FeatureDatasheet:
    """One feature as machining sees it: static, self-contained, and enough to choose a
    tool against without having the part in hand. All lengths mm and angles degrees;
    z runs up the tool axis, so `zMin` is the bottom of the feature and `zMax` its top.

        Attributes:
            feature_type (FeatureType): What kind of thing a feature is, and so how it gets machined. The names are the
                contract at this boundary (the shared numeric wire format stays inside the binary
                API).
            z_min (float): Bottom of the feature along the tool axis, in mm.
            z_max (float): Top of the feature along the tool axis, in mm.
            extended_z_min (float): Bottom of the band a pass over the feature reaches, in mm: `zMin`, or lower where a
                chamfer on the far edge of a through feature deepens it. This, not `zMin`, is where
                a wall pass and the whole-part rough run out, the reach a tool is held to, and the
                depth the time estimates and setup planning price.
            extended_z_max (float): Highest z the tool passes over while reaching the feature, in mm: `zMax`, or higher
                where a chamfer or fillet sits on top of it.
            reach_curve (ReachCurve): How deep a tool must reach, by how far outboard of the cut the material stands:
                material
                within `horizontalOffset[i]` of the feature rises to `verticalOffset[i]` above it, so
                anything on the tool standing that far past its own cutting edge must clear that much.
                Both arrays are the same length, ascending, non-negative, in mm; the curve is a
                non-decreasing step function, and offsets beyond its last knot clamp to it.

                Offsets are measured from the feature, never from the tool's axis: offset zero is the
                wall of the cut, so material at offset `d` meets the tool at radius `d` plus the cutting
                radius. Each reading is the worst case over the feature's whole surface — the tallest
                material within that distance of any point of it, measured above that point.

                ![A tool cutting a pocket whose wall stands at the cut, with a boss further out: the
                horizontal offsets run outward from the feature's edge, the vertical offsets up from
                its floor](./media/reach-curve.svg)

                The tool checks sweep a tool's shank and holder over this curve; it is here so a
                caller can draw it, or sweep an envelope of its own.
            axial_stock_to_leave (float): Material intentionally left along the tool axis for a later operation, in mm.
            radial_stock_to_leave (float): Material intentionally left radially for a later operation, in mm.
            tolerance_band (ToleranceBand): How far a machined surface may deviate from the model, in three escalating bands
                (`0 <= ignore <= deviate <= max`).
            has_floor (bool): Whether the feature has a floor machined perpendicular to the tool axis.
            has_wall (bool): Whether the feature has a wall machined parallel to the tool axis.
            projected_floor_area (float): Projected area machined floor-wise (perpendicular to the tool axis).
            projected_wall_area (float): Area machined wall-wise (parallel to the tool axis).
            facts (BossFacts | ChamferFacts | DovetailFacts | FaceFacts | HoleFacts | PocketFacts | ProfileFacts |
                SurfaceFacts | TslotFacts | WallFacts): The per-kind facts; narrow on `facts.kind`.
            floorish_area (float | Unset): Deprecated: use `projectedFloorArea`. Removed in the next API major.
            wallish_area (float | Unset): Deprecated: use `projectedWallArea`. Removed in the next API major.
            areas (SurfaceAreas | Unset): What a feature's surface is made of: every region of it in exactly one bucket, so
                the five
                add up to its surface area and nothing is counted twice.

                A description of the feature, not of a pass — see `projectedFloorArea` for the pair that
                says what a pass sweeps, and the picture there for how the two families differ. A bucket is
                zero where the feature has no such surface. Areas are of the meshed regions, so a curved
                surface reads a shade under its exact area.
            pinch_points (list[PinchPoint] | Unset): The places the feature is at its tightest: where the clearance reaches
                the minimum
                `cd` reports, one disc per stretch of the feature that reaches it, tightest first
                and never more than ten.

                The counterpart of a bound rather than another bound: what these answer is *where*
                the clearance minimum was decided, which the number itself cannot. A drawing is the
                audience, which is why the list is capped — a feature can tie in dozens of places,
                and the eleventh disc tells a reader nothing the first ten did not.

                Empty for the kinds whose clearance is not measured off a single medial axis — a
                hole, a facing pass, the undercut and layered kinds — so empty is "nowhere to point
                at", never "nowhere is tight".
    """

    feature_type: FeatureType
    z_min: float
    z_max: float
    extended_z_min: float
    extended_z_max: float
    reach_curve: ReachCurve
    axial_stock_to_leave: float
    radial_stock_to_leave: float
    tolerance_band: ToleranceBand
    has_floor: bool
    has_wall: bool
    projected_floor_area: float
    projected_wall_area: float
    facts: (
        BossFacts
        | ChamferFacts
        | DovetailFacts
        | FaceFacts
        | HoleFacts
        | PocketFacts
        | ProfileFacts
        | SurfaceFacts
        | TslotFacts
        | WallFacts
    )
    floorish_area: float | Unset = UNSET
    wallish_area: float | Unset = UNSET
    areas: SurfaceAreas | Unset = UNSET
    pinch_points: list[PinchPoint] | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        from ..models.boss_facts import BossFacts
        from ..models.chamfer_facts import ChamferFacts
        from ..models.dovetail_facts import DovetailFacts
        from ..models.face_facts import FaceFacts
        from ..models.hole_facts import HoleFacts
        from ..models.pocket_facts import PocketFacts
        from ..models.profile_facts import ProfileFacts
        from ..models.surface_facts import SurfaceFacts
        from ..models.wall_facts import WallFacts

        feature_type = self.feature_type.value

        z_min = self.z_min

        z_max = self.z_max

        extended_z_min = self.extended_z_min

        extended_z_max = self.extended_z_max

        reach_curve = self.reach_curve.to_dict()

        axial_stock_to_leave = self.axial_stock_to_leave

        radial_stock_to_leave = self.radial_stock_to_leave

        tolerance_band = self.tolerance_band.to_dict()

        has_floor = self.has_floor

        has_wall = self.has_wall

        projected_floor_area = self.projected_floor_area

        projected_wall_area = self.projected_wall_area

        facts: dict[str, Any]
        if isinstance(self.facts, HoleFacts):
            facts = self.facts.to_dict()
        elif isinstance(self.facts, PocketFacts):
            facts = self.facts.to_dict()
        elif isinstance(self.facts, BossFacts):
            facts = self.facts.to_dict()
        elif isinstance(self.facts, WallFacts):
            facts = self.facts.to_dict()
        elif isinstance(self.facts, FaceFacts):
            facts = self.facts.to_dict()
        elif isinstance(self.facts, SurfaceFacts):
            facts = self.facts.to_dict()
        elif isinstance(self.facts, ChamferFacts):
            facts = self.facts.to_dict()
        elif isinstance(self.facts, ProfileFacts):
            facts = self.facts.to_dict()
        elif isinstance(self.facts, DovetailFacts):
            facts = self.facts.to_dict()
        else:
            facts = self.facts.to_dict()

        floorish_area = self.floorish_area

        wallish_area = self.wallish_area

        areas: dict[str, Any] | Unset = UNSET
        if not isinstance(self.areas, Unset):
            areas = self.areas.to_dict()

        pinch_points: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.pinch_points, Unset):
            pinch_points = []
            for pinch_points_item_data in self.pinch_points:
                pinch_points_item = pinch_points_item_data.to_dict()
                pinch_points.append(pinch_points_item)

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "featureType": feature_type,
                "zMin": z_min,
                "zMax": z_max,
                "extendedZMin": extended_z_min,
                "extendedZMax": extended_z_max,
                "reachCurve": reach_curve,
                "axialStockToLeave": axial_stock_to_leave,
                "radialStockToLeave": radial_stock_to_leave,
                "toleranceBand": tolerance_band,
                "hasFloor": has_floor,
                "hasWall": has_wall,
                "projectedFloorArea": projected_floor_area,
                "projectedWallArea": projected_wall_area,
                "facts": facts,
            }
        )
        if floorish_area is not UNSET:
            field_dict["floorishArea"] = floorish_area
        if wallish_area is not UNSET:
            field_dict["wallishArea"] = wallish_area
        if areas is not UNSET:
            field_dict["areas"] = areas
        if pinch_points is not UNSET:
            field_dict["pinchPoints"] = pinch_points

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.boss_facts import BossFacts
        from ..models.chamfer_facts import ChamferFacts
        from ..models.dovetail_facts import DovetailFacts
        from ..models.face_facts import FaceFacts
        from ..models.hole_facts import HoleFacts
        from ..models.pinch_point import PinchPoint
        from ..models.pocket_facts import PocketFacts
        from ..models.profile_facts import ProfileFacts
        from ..models.reach_curve import ReachCurve
        from ..models.surface_areas import SurfaceAreas
        from ..models.surface_facts import SurfaceFacts
        from ..models.tolerance_band import ToleranceBand
        from ..models.tslot_facts import TslotFacts
        from ..models.wall_facts import WallFacts

        d = dict(src_dict)
        feature_type = FeatureType(d.pop("featureType"))

        z_min = d.pop("zMin")

        z_max = d.pop("zMax")

        extended_z_min = d.pop("extendedZMin")

        extended_z_max = d.pop("extendedZMax")

        reach_curve = ReachCurve.from_dict(d.pop("reachCurve"))

        axial_stock_to_leave = d.pop("axialStockToLeave")

        radial_stock_to_leave = d.pop("radialStockToLeave")

        tolerance_band = ToleranceBand.from_dict(d.pop("toleranceBand"))

        has_floor = d.pop("hasFloor")

        has_wall = d.pop("hasWall")

        projected_floor_area = d.pop("projectedFloorArea")

        projected_wall_area = d.pop("projectedWallArea")

        def _parse_facts(
            data: object,
        ) -> (
            BossFacts
            | ChamferFacts
            | DovetailFacts
            | FaceFacts
            | HoleFacts
            | PocketFacts
            | ProfileFacts
            | SurfaceFacts
            | TslotFacts
            | WallFacts
        ):
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                facts_type_0 = HoleFacts.from_dict(data)

                return facts_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                facts_type_1 = PocketFacts.from_dict(data)

                return facts_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                facts_type_2 = BossFacts.from_dict(data)

                return facts_type_2
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                facts_type_3 = WallFacts.from_dict(data)

                return facts_type_3
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                facts_type_4 = FaceFacts.from_dict(data)

                return facts_type_4
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                facts_type_5 = SurfaceFacts.from_dict(data)

                return facts_type_5
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                facts_type_6 = ChamferFacts.from_dict(data)

                return facts_type_6
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                facts_type_7 = ProfileFacts.from_dict(data)

                return facts_type_7
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                facts_type_8 = DovetailFacts.from_dict(data)

                return facts_type_8
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            facts_type_9 = TslotFacts.from_dict(data)

            return facts_type_9

        facts = _parse_facts(d.pop("facts"))

        floorish_area = d.pop("floorishArea", UNSET)

        wallish_area = d.pop("wallishArea", UNSET)

        _areas = d.pop("areas", UNSET)
        areas: SurfaceAreas | Unset
        if isinstance(_areas, Unset):
            areas = UNSET
        else:
            areas = SurfaceAreas.from_dict(_areas)

        _pinch_points = d.pop("pinchPoints", UNSET)
        pinch_points: list[PinchPoint] | Unset = UNSET
        if _pinch_points is not UNSET:
            pinch_points = []
            for pinch_points_item_data in _pinch_points:
                pinch_points_item = PinchPoint.from_dict(pinch_points_item_data)

                pinch_points.append(pinch_points_item)

        feature_datasheet = cls(
            feature_type=feature_type,
            z_min=z_min,
            z_max=z_max,
            extended_z_min=extended_z_min,
            extended_z_max=extended_z_max,
            reach_curve=reach_curve,
            axial_stock_to_leave=axial_stock_to_leave,
            radial_stock_to_leave=radial_stock_to_leave,
            tolerance_band=tolerance_band,
            has_floor=has_floor,
            has_wall=has_wall,
            projected_floor_area=projected_floor_area,
            projected_wall_area=projected_wall_area,
            facts=facts,
            floorish_area=floorish_area,
            wallish_area=wallish_area,
            areas=areas,
            pinch_points=pinch_points,
        )

        return feature_datasheet
