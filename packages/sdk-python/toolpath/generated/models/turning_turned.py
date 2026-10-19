from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.axis_source import AxisSource
from ..models.turning_turned_kind import TurningTurnedKind

if TYPE_CHECKING:
    from ..models.outline_point import OutlinePoint
    from ..models.turned_feature import TurnedFeature
    from ..models.turning_frame import TurningFrame


T = TypeVar("T", bound="TurningTurned")


@_attrs_define
class TurningTurned:
    """The part read about its turning axis.

    Attributes:
        kind (TurningTurnedKind): Discriminator: the part was read.
        axis_source (AxisSource): Where the axis came from: `Detected` is the axis the part’s revolved surfaces agree
            on.
        frame (TurningFrame): The half-plane a part is turned in: the axis, and how `(z, r)` lies in part coordinates —
            the point `location + z·direction + r·radial`.
        area_fraction (float): The fraction of the part’s surface area lying on the outline within tolerance, from 0 to
            1: what a lathe spinning the part here leaves finished.
        turnability (float): The fraction of the outline’s revolved volume the part keeps, from 0 to 1. The rest is what
            turning leaves to be cut away some other way.
        outline (list[list[OutlinePoint]]): The outline’s loops, each outer one followed by the inner loops inside it.
        features (list[TurnedFeature]): The outline’s features, in its order. A stretch both ends reach is listed twice,
            once per `approach`.
        region_idxs_left_for_milling (list[int]): Indexes of the regions not wholly on the outline, ascending: what
            turning leaves for milling. A modeled thread’s regions are not among them.
        feature_tags_left_for_milling (list[str]): The milled features turning leaves for milling: each one with a
            region among `regionIdxsLeftForMilling`, whole, so a feature partly on the outline is listed. Join each value to
            `features[].featureTag`; the order is not meaningful.
    """

    kind: TurningTurnedKind
    axis_source: AxisSource
    frame: TurningFrame
    area_fraction: float
    turnability: float
    outline: list[list[OutlinePoint]]
    features: list[TurnedFeature]
    region_idxs_left_for_milling: list[int]
    feature_tags_left_for_milling: list[str]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        kind = self.kind.value

        axis_source = self.axis_source.value

        frame = self.frame.to_dict()

        area_fraction = self.area_fraction

        turnability = self.turnability

        outline = []
        for outline_item_data in self.outline:
            outline_item = []
            for outline_item_item_data in outline_item_data:
                outline_item_item = outline_item_item_data.to_dict()
                outline_item.append(outline_item_item)

            outline.append(outline_item)

        features = []
        for features_item_data in self.features:
            features_item = features_item_data.to_dict()
            features.append(features_item)

        region_idxs_left_for_milling = self.region_idxs_left_for_milling

        feature_tags_left_for_milling = self.feature_tags_left_for_milling

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "kind": kind,
                "axisSource": axis_source,
                "frame": frame,
                "areaFraction": area_fraction,
                "turnability": turnability,
                "outline": outline,
                "features": features,
                "regionIdxsLeftForMilling": region_idxs_left_for_milling,
                "featureTagsLeftForMilling": feature_tags_left_for_milling,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.outline_point import OutlinePoint
        from ..models.turned_feature import TurnedFeature
        from ..models.turning_frame import TurningFrame

        d = dict(src_dict)
        kind = TurningTurnedKind(d.pop("kind"))

        axis_source = AxisSource(d.pop("axisSource"))

        frame = TurningFrame.from_dict(d.pop("frame"))

        area_fraction = d.pop("areaFraction")

        turnability = d.pop("turnability")

        outline = []
        _outline = d.pop("outline")
        for outline_item_data in _outline:
            outline_item = []
            _outline_item = outline_item_data
            for outline_item_item_data in _outline_item:
                outline_item_item = OutlinePoint.from_dict(outline_item_item_data)

                outline_item.append(outline_item_item)

            outline.append(outline_item)

        features = []
        _features = d.pop("features")
        for features_item_data in _features:
            features_item = TurnedFeature.from_dict(features_item_data)

            features.append(features_item)

        region_idxs_left_for_milling = cast(list[int], d.pop("regionIdxsLeftForMilling"))

        feature_tags_left_for_milling = cast(list[str], d.pop("featureTagsLeftForMilling"))

        turning_turned = cls(
            kind=kind,
            axis_source=axis_source,
            frame=frame,
            area_fraction=area_fraction,
            turnability=turnability,
            outline=outline,
            features=features,
            region_idxs_left_for_milling=region_idxs_left_for_milling,
            feature_tags_left_for_milling=feature_tags_left_for_milling,
        )

        turning_turned.additional_properties = d
        return turning_turned

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
