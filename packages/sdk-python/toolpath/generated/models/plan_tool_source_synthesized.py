from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.plan_tool_source_synthesized_kind import PlanToolSourceSynthesizedKind

T = TypeVar("T", bound="PlanToolSourceSynthesized")


@_attrs_define
class PlanToolSourceSynthesized:
    """**Experimental.** Available now and still gaining functionality. It may change in breaking ways in a minor API
    release; each such change is listed in the release notes, so check them before upgrading.

    A tool the plan made: from an implicit library of the crib, or past the crib for a job that asked for
    `fallbackTools`. Its assembly is the tool as the Engine made it: its head by its own dimensions, and its `shaft` the
    Engine’s own, from the flutes up to the holder’s nose, which its `stickout` reaches. What the holder grips is not
    stated, so neither its overall length nor its shank is, and it has no `guid`: a reader that needs them states its
    own. Its `holder` is null, the holder not known, and it has no `collet`. Where the Engine could not read the tool in
    full, its shaft is assumed of its cutting diameter up to its stickout.

        Attributes:
            kind (PlanToolSourceSynthesizedKind): Made by the plan.
    """

    kind: PlanToolSourceSynthesizedKind
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        kind = self.kind.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "kind": kind,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = PlanToolSourceSynthesizedKind(d.pop("kind"))

        plan_tool_source_synthesized = cls(
            kind=kind,
        )

        plan_tool_source_synthesized.additional_properties = d
        return plan_tool_source_synthesized

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
