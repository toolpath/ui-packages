from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.plan_issue_kind import PlanIssueKind
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.plan_issue_feature import PlanIssueFeature


T = TypeVar("T", bound="PlanIssue")


@_attrs_define
class PlanIssue:
    """
    Attributes:
        kind (PlanIssueKind): How the plan falls short: `Unseen` (regions no direction reaches at all), `OutOfPlay`
            (regions some direction reaches but no feature in play holds — one the kernel rejected or excluded, or one left
            out because it would not measure) or `Incomplete` (regions some feature could reach that the plan leaves
            untouched).
        area (float): Faceted area of this shortfall, in mm² — the figure to gate a quote on.
        region_count (int): How many part regions this shortfall covers.
        features (list[PlanIssueFeature] | Unset): For an `OutOfPlay` shortfall, the features holding its regions that
            were never in play, and why. A region can be held by several features. Empty for `Unseen`, whose regions no
            feature holds. Absent for `Incomplete`, on every issue of a plan whose features could not be read (its issues
            are stated without them), and on plans made before this was recorded.
        unattributed_region_count (int | Unset): How many of this shortfall’s regions no feature in `features` holds:
            all of them for `Unseen`. A sliver held only by an edge break’s dead stop counts here, and so does a region held
            only by a feature the plan never measured, because it could do without it. Absent where `features` is.
    """

    kind: PlanIssueKind
    area: float
    region_count: int
    features: list[PlanIssueFeature] | Unset = UNSET
    unattributed_region_count: int | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        kind = self.kind.value

        area = self.area

        region_count = self.region_count

        features: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.features, Unset):
            features = []
            for features_item_data in self.features:
                features_item = features_item_data.to_dict()
                features.append(features_item)

        unattributed_region_count = self.unattributed_region_count

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "kind": kind,
                "area": area,
                "regionCount": region_count,
            }
        )
        if features is not UNSET:
            field_dict["features"] = features
        if unattributed_region_count is not UNSET:
            field_dict["unattributedRegionCount"] = unattributed_region_count

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.plan_issue_feature import PlanIssueFeature

        d = dict(src_dict)
        kind = PlanIssueKind(d.pop("kind"))

        area = d.pop("area")

        region_count = d.pop("regionCount")

        _features = d.pop("features", UNSET)
        features: list[PlanIssueFeature] | Unset = UNSET
        if _features is not UNSET:
            features = []
            for features_item_data in _features:
                features_item = PlanIssueFeature.from_dict(features_item_data)

                features.append(features_item)

        unattributed_region_count = d.pop("unattributedRegionCount", UNSET)

        plan_issue = cls(
            kind=kind,
            area=area,
            region_count=region_count,
            features=features,
            unattributed_region_count=unattributed_region_count,
        )

        plan_issue.additional_properties = d
        return plan_issue

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
