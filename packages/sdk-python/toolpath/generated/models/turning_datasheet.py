from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define

from ..models.axial_direction import AxialDirection
from ..models.mounting_axis import MountingAxis
from ..models.turned_feature_type import TurnedFeatureType
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.reach_curve import ReachCurve
    from ..models.slope_span import SlopeSpan
    from ..models.tolerance_band import ToleranceBand
    from ..models.turned_axial_hole_facts import TurnedAxialHoleFacts
    from ..models.turned_face_facts import TurnedFaceFacts
    from ..models.turned_face_groove_facts import TurnedFaceGrooveFacts
    from ..models.turned_groove_facts import TurnedGrooveFacts
    from ..models.turned_outline_facts import TurnedOutlineFacts
    from ..models.turned_thread_facts import TurnedThreadFacts


T = TypeVar("T", bound="TurningDatasheet")


@_attrs_define
class TurningDatasheet:
    """One turned feature as a tool check sees it: the turning counterpart of a
    `FeatureDatasheet`. In `(z, r)`, mm and degrees.

        Attributes:
            feature_type (TurnedFeatureType): What a turned feature is.
            facts (TurnedAxialHoleFacts | TurnedFaceFacts | TurnedFaceGrooveFacts | TurnedGrooveFacts | TurnedOutlineFacts |
                TurnedThreadFacts): What it measures, by kind; narrow on `facts.kind`.
            z_min (float): Its start along the axis, in mm.
            z_max (float): Its end along the axis, in mm.
            r_min (float): Its nearest to the axis, in mm.
            r_max (float): Its farthest from the axis, in mm.
            mounting (MountingAxis): How a tool must be mounted to reach a feature.
            slope_spans (list[SlopeSpan]): **Experimental.** Available now and still gaining functionality. It may change in
                breaking ways in a minor API release; each such change is listed in the release notes, so check them before
                upgrading.

                How steeply each of its curves rises and falls along a feed, in the order they run.
            radial_reach_minus_z (ReachCurve): Surrounding material height as a function of distance from the feature.
                Material
                within `horizontalOffset[i]` rises to `verticalOffset[i]` above the feature. Each
                reading is the worst case over the feature's whole surface, measured above each
                sampled point.
                Both arrays are the same length, ascending, non-negative, in mm. Evaluate the step
                function at the first knot whose horizontal offset is at least the query distance;
                queries beyond the last knot clamp to it.

                The last knot can stand well beyond the others, at the plan-view diagonal of the part and
                its fixtures: where material anywhere in the setup stands taller than the nearer offsets
                read, that knot carries it, since the spindle face atop a finite holder has to clear it
                however far off it stands.

                Offsets start at the feature, not the tool axis, and retain no obstacle direction.
                For an open feature, the cutter can sit between its contact point and an obstacle.
                A cylindrical holder of radius `R` at least as large as the cutting radius `r` reads
                the curve at `R + r`: that height is the required stickout before clearances. For example, a
                Ø10 cutter with a Ø24 holder reads at 17 mm from the feature, not 7 mm.

                ![A cutter beside an external wall, with an obstacle beyond the cutter: the holder
                footprint extends R + r from the contact point](./media/reach-curve.svg)

                Closed features allow an optimization: enclosing material lies beyond the cutting
                edge away from the axis, so a holder wider than the cutter reads at `R - r` instead;
                a holder narrower than the cutter adds no reach constraint. Tool checks
                use this for holes, sinks, non-open pockets, U-slots and threads; potentially open
                feature kinds use the conservative `R + r` footprint. The curve can overestimate
                holder reach because it has lost obstacle direction; it is not a collision proof.

                ![A cutter inside a closed pocket, with horizontal offsets measured outward from
                its floor and vertical offsets measured upward](./media/reach-curve-closed.svg)

                Here the cutter sits inside the pocket. Only the holder's overhang beyond the
                cutting edge, `R - r`, extends over the surrounding material.

                Shaft checks (neck, shoulder, and shank) read every feature as the closed pocket above, at
                `R - r`. Tool checks sweep tapered shaft and holder layers with their heights and
                clearances; the cylindrical example above explains the holder footprint. Callers can draw
                the curve or sweep an envelope of their own.
            radial_reach_plus_z (ReachCurve): Surrounding material height as a function of distance from the feature.
                Material
                within `horizontalOffset[i]` rises to `verticalOffset[i]` above the feature. Each
                reading is the worst case over the feature's whole surface, measured above each
                sampled point.
                Both arrays are the same length, ascending, non-negative, in mm. Evaluate the step
                function at the first knot whose horizontal offset is at least the query distance;
                queries beyond the last knot clamp to it.

                The last knot can stand well beyond the others, at the plan-view diagonal of the part and
                its fixtures: where material anywhere in the setup stands taller than the nearer offsets
                read, that knot carries it, since the spindle face atop a finite holder has to clear it
                however far off it stands.

                Offsets start at the feature, not the tool axis, and retain no obstacle direction.
                For an open feature, the cutter can sit between its contact point and an obstacle.
                A cylindrical holder of radius `R` at least as large as the cutting radius `r` reads
                the curve at `R + r`: that height is the required stickout before clearances. For example, a
                Ø10 cutter with a Ø24 holder reads at 17 mm from the feature, not 7 mm.

                ![A cutter beside an external wall, with an obstacle beyond the cutter: the holder
                footprint extends R + r from the contact point](./media/reach-curve.svg)

                Closed features allow an optimization: enclosing material lies beyond the cutting
                edge away from the axis, so a holder wider than the cutter reads at `R - r` instead;
                a holder narrower than the cutter adds no reach constraint. Tool checks
                use this for holes, sinks, non-open pockets, U-slots and threads; potentially open
                feature kinds use the conservative `R + r` footprint. The curve can overestimate
                holder reach because it has lost obstacle direction; it is not a collision proof.

                ![A cutter inside a closed pocket, with horizontal offsets measured outward from
                its floor and vertical offsets measured upward](./media/reach-curve-closed.svg)

                Here the cutter sits inside the pocket. Only the holder's overhang beyond the
                cutting edge, `R - r`, extends over the surrounding material.

                Shaft checks (neck, shoulder, and shank) read every feature as the closed pocket above, at
                `R - r`. Tool checks sweep tapered shaft and holder layers with their heights and
                clearances; the cylindrical example above explains the holder footprint. Callers can draw
                the curve or sweep an envelope of their own.
            axial_reach (ReachCurve): Surrounding material height as a function of distance from the feature. Material
                within `horizontalOffset[i]` rises to `verticalOffset[i]` above the feature. Each
                reading is the worst case over the feature's whole surface, measured above each
                sampled point.
                Both arrays are the same length, ascending, non-negative, in mm. Evaluate the step
                function at the first knot whose horizontal offset is at least the query distance;
                queries beyond the last knot clamp to it.

                The last knot can stand well beyond the others, at the plan-view diagonal of the part and
                its fixtures: where material anywhere in the setup stands taller than the nearer offsets
                read, that knot carries it, since the spindle face atop a finite holder has to clear it
                however far off it stands.

                Offsets start at the feature, not the tool axis, and retain no obstacle direction.
                For an open feature, the cutter can sit between its contact point and an obstacle.
                A cylindrical holder of radius `R` at least as large as the cutting radius `r` reads
                the curve at `R + r`: that height is the required stickout before clearances. For example, a
                Ø10 cutter with a Ø24 holder reads at 17 mm from the feature, not 7 mm.

                ![A cutter beside an external wall, with an obstacle beyond the cutter: the holder
                footprint extends R + r from the contact point](./media/reach-curve.svg)

                Closed features allow an optimization: enclosing material lies beyond the cutting
                edge away from the axis, so a holder wider than the cutter reads at `R - r` instead;
                a holder narrower than the cutter adds no reach constraint. Tool checks
                use this for holes, sinks, non-open pockets, U-slots and threads; potentially open
                feature kinds use the conservative `R + r` footprint. The curve can overestimate
                holder reach because it has lost obstacle direction; it is not a collision proof.

                ![A cutter inside a closed pocket, with horizontal offsets measured outward from
                its floor and vertical offsets measured upward](./media/reach-curve-closed.svg)

                Here the cutter sits inside the pocket. Only the holder's overhang beyond the
                cutting edge, `R - r`, extends over the surrounding material.

                Shaft checks (neck, shoulder, and shank) read every feature as the closed pocket above, at
                `R - r`. Tool checks sweep tapered shaft and holder layers with their heights and
                clearances; the cylindrical example above explains the holder footprint. Callers can draw
                the curve or sweep an envelope of their own.
            axial_stock_to_leave (float): Material left along the spindle, in mm.
            radial_stock_to_leave (float): Material left across the spindle, in mm.
            tolerance_band (ToleranceBand): How far a machined surface may deviate from the model, in three escalating bands
                (`0 <= ignore <= deviate <= max`, all finite).
            approach (AxialDirection | Unset): Which way along the axis something looks or comes from.
            entry_diameter (float | Unset): For a feature in a hole, the narrowest diameter between it and the end it is cut
                from, in mm: what a bar entering from that end passes on its way in. Absent for any
                other feature, or where nothing stands between.
            min_concave_radius (float | Unset): The smallest radius of a concave corner between or on its curves, in mm, 0
                for a
                sharp one; absent where it has none.
    """

    feature_type: TurnedFeatureType
    facts: (
        TurnedAxialHoleFacts
        | TurnedFaceFacts
        | TurnedFaceGrooveFacts
        | TurnedGrooveFacts
        | TurnedOutlineFacts
        | TurnedThreadFacts
    )
    z_min: float
    z_max: float
    r_min: float
    r_max: float
    mounting: MountingAxis
    slope_spans: list[SlopeSpan]
    radial_reach_minus_z: ReachCurve
    radial_reach_plus_z: ReachCurve
    axial_reach: ReachCurve
    axial_stock_to_leave: float
    radial_stock_to_leave: float
    tolerance_band: ToleranceBand
    approach: AxialDirection | Unset = UNSET
    entry_diameter: float | Unset = UNSET
    min_concave_radius: float | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        from ..models.turned_face_facts import TurnedFaceFacts
        from ..models.turned_face_groove_facts import TurnedFaceGrooveFacts
        from ..models.turned_groove_facts import TurnedGrooveFacts
        from ..models.turned_outline_facts import TurnedOutlineFacts
        from ..models.turned_thread_facts import TurnedThreadFacts

        feature_type = self.feature_type.value

        facts: dict[str, Any]
        if isinstance(self.facts, TurnedOutlineFacts):
            facts = self.facts.to_dict()
        elif isinstance(self.facts, TurnedFaceFacts):
            facts = self.facts.to_dict()
        elif isinstance(self.facts, TurnedGrooveFacts):
            facts = self.facts.to_dict()
        elif isinstance(self.facts, TurnedFaceGrooveFacts):
            facts = self.facts.to_dict()
        elif isinstance(self.facts, TurnedThreadFacts):
            facts = self.facts.to_dict()
        else:
            facts = self.facts.to_dict()

        z_min = self.z_min

        z_max = self.z_max

        r_min = self.r_min

        r_max = self.r_max

        mounting = self.mounting.value

        slope_spans = []
        for slope_spans_item_data in self.slope_spans:
            slope_spans_item = slope_spans_item_data.to_dict()
            slope_spans.append(slope_spans_item)

        radial_reach_minus_z = self.radial_reach_minus_z.to_dict()

        radial_reach_plus_z = self.radial_reach_plus_z.to_dict()

        axial_reach = self.axial_reach.to_dict()

        axial_stock_to_leave = self.axial_stock_to_leave

        radial_stock_to_leave = self.radial_stock_to_leave

        tolerance_band = self.tolerance_band.to_dict()

        approach: str | Unset = UNSET
        if not isinstance(self.approach, Unset):
            approach = self.approach.value

        entry_diameter = self.entry_diameter

        min_concave_radius = self.min_concave_radius

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "featureType": feature_type,
                "facts": facts,
                "zMin": z_min,
                "zMax": z_max,
                "rMin": r_min,
                "rMax": r_max,
                "mounting": mounting,
                "slopeSpans": slope_spans,
                "radialReachMinusZ": radial_reach_minus_z,
                "radialReachPlusZ": radial_reach_plus_z,
                "axialReach": axial_reach,
                "axialStockToLeave": axial_stock_to_leave,
                "radialStockToLeave": radial_stock_to_leave,
                "toleranceBand": tolerance_band,
            }
        )
        if approach is not UNSET:
            field_dict["approach"] = approach
        if entry_diameter is not UNSET:
            field_dict["entryDiameter"] = entry_diameter
        if min_concave_radius is not UNSET:
            field_dict["minConcaveRadius"] = min_concave_radius

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.reach_curve import ReachCurve
        from ..models.slope_span import SlopeSpan
        from ..models.tolerance_band import ToleranceBand
        from ..models.turned_axial_hole_facts import TurnedAxialHoleFacts
        from ..models.turned_face_facts import TurnedFaceFacts
        from ..models.turned_face_groove_facts import TurnedFaceGrooveFacts
        from ..models.turned_groove_facts import TurnedGrooveFacts
        from ..models.turned_outline_facts import TurnedOutlineFacts
        from ..models.turned_thread_facts import TurnedThreadFacts

        d = dict(src_dict)
        feature_type = TurnedFeatureType(d.pop("featureType"))

        def _parse_facts(
            data: object,
        ) -> (
            TurnedAxialHoleFacts
            | TurnedFaceFacts
            | TurnedFaceGrooveFacts
            | TurnedGrooveFacts
            | TurnedOutlineFacts
            | TurnedThreadFacts
        ):
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                facts_type_0 = TurnedOutlineFacts.from_dict(data)

                return facts_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                facts_type_1 = TurnedFaceFacts.from_dict(data)

                return facts_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                facts_type_2 = TurnedGrooveFacts.from_dict(data)

                return facts_type_2
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                facts_type_3 = TurnedFaceGrooveFacts.from_dict(data)

                return facts_type_3
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                facts_type_4 = TurnedThreadFacts.from_dict(data)

                return facts_type_4
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            facts_type_5 = TurnedAxialHoleFacts.from_dict(data)

            return facts_type_5

        facts = _parse_facts(d.pop("facts"))

        z_min = d.pop("zMin")

        z_max = d.pop("zMax")

        r_min = d.pop("rMin")

        r_max = d.pop("rMax")

        mounting = MountingAxis(d.pop("mounting"))

        slope_spans = []
        _slope_spans = d.pop("slopeSpans")
        for slope_spans_item_data in _slope_spans:
            slope_spans_item = SlopeSpan.from_dict(slope_spans_item_data)

            slope_spans.append(slope_spans_item)

        radial_reach_minus_z = ReachCurve.from_dict(d.pop("radialReachMinusZ"))

        radial_reach_plus_z = ReachCurve.from_dict(d.pop("radialReachPlusZ"))

        axial_reach = ReachCurve.from_dict(d.pop("axialReach"))

        axial_stock_to_leave = d.pop("axialStockToLeave")

        radial_stock_to_leave = d.pop("radialStockToLeave")

        tolerance_band = ToleranceBand.from_dict(d.pop("toleranceBand"))

        _approach = d.pop("approach", UNSET)
        approach: AxialDirection | Unset
        if isinstance(_approach, Unset):
            approach = UNSET
        else:
            approach = AxialDirection(_approach)

        entry_diameter = d.pop("entryDiameter", UNSET)

        min_concave_radius = d.pop("minConcaveRadius", UNSET)

        turning_datasheet = cls(
            feature_type=feature_type,
            facts=facts,
            z_min=z_min,
            z_max=z_max,
            r_min=r_min,
            r_max=r_max,
            mounting=mounting,
            slope_spans=slope_spans,
            radial_reach_minus_z=radial_reach_minus_z,
            radial_reach_plus_z=radial_reach_plus_z,
            axial_reach=axial_reach,
            axial_stock_to_leave=axial_stock_to_leave,
            radial_stock_to_leave=radial_stock_to_leave,
            tolerance_band=tolerance_band,
            approach=approach,
            entry_diameter=entry_diameter,
            min_concave_radius=min_concave_radius,
        )

        return turning_datasheet
