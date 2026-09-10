from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.plan_issue_kind import PlanIssueKind

T = TypeVar("T", bound="PlanIssue")


@_attrs_define
class PlanIssue:
    """
    Attributes:
        kind (PlanIssueKind): How the plan falls short: `Unseen` (regions no offered feature reaches from any direction
            that the plan owes) or `Incomplete` (regions some feature could reach that the plan leaves untouched).
        area (float): Faceted area of this shortfall, in mm² — the figure to gate a quote on.
        region_count (int): How many part regions this shortfall covers.
    """

    kind: PlanIssueKind
    area: float
    region_count: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        kind = self.kind.value

        area = self.area

        region_count = self.region_count

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "kind": kind,
                "area": area,
                "regionCount": region_count,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = PlanIssueKind(d.pop("kind"))

        area = d.pop("area")

        region_count = d.pop("regionCount")

        plan_issue = cls(
            kind=kind,
            area=area,
            region_count=region_count,
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
