from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.plan_tool_source_fusion import PlanToolSourceFusion
    from ..models.plan_tool_source_synthesized import PlanToolSourceSynthesized
    from ..models.rotating_tool_assembly import RotatingToolAssembly


T = TypeVar("T", bound="PlanTool")


@_attrs_define
class PlanTool:
    """**Experimental.** Available now and still gaining functionality. It may change in breaking ways in a minor API
    release; each such change is listed in the release notes, so check them before upgrading.

    A tool the plan’s actions use, as `@toolpath/tool-support` models it: the authoritative description of the tool,
    which an action names by its `toolKey` (see `PlanResponse.tools`), beside the kernel’s summary each action carries
    in `tool`, from which it can differ (see `assembly`).

        Attributes:
            key (str): The tool’s key, as the plan’s actions name it (`toolKey`): valid within this plan only.
            source (PlanToolSourceFusion | PlanToolSourceSynthesized): Where the tool came from: a Fusion tool library
                entry, or the plan itself.
            assembly (RotatingToolAssembly): **Experimental.** Available now and still gaining functionality. It may change
                in breaking ways in a minor API release; each such change is listed in the release notes, so check them before
                upgrading.

                A tool as it is put in the spindle: the tool, what holds it, and how far it stands out.
    """

    key: str
    source: PlanToolSourceFusion | PlanToolSourceSynthesized
    assembly: RotatingToolAssembly
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.plan_tool_source_fusion import PlanToolSourceFusion

        key = self.key

        source: dict[str, Any]
        if isinstance(self.source, PlanToolSourceFusion):
            source = self.source.to_dict()
        else:
            source = self.source.to_dict()

        assembly = self.assembly.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "key": key,
                "source": source,
                "assembly": assembly,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.plan_tool_source_fusion import PlanToolSourceFusion
        from ..models.plan_tool_source_synthesized import PlanToolSourceSynthesized
        from ..models.rotating_tool_assembly import RotatingToolAssembly

        d = dict(src_dict)
        key = d.pop("key")

        def _parse_source(data: object) -> PlanToolSourceFusion | PlanToolSourceSynthesized:
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                source_type_0 = PlanToolSourceFusion.from_dict(data)

                return source_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            source_type_1 = PlanToolSourceSynthesized.from_dict(data)

            return source_type_1

        source = _parse_source(d.pop("source"))

        assembly = RotatingToolAssembly.from_dict(d.pop("assembly"))

        plan_tool = cls(
            key=key,
            source=source,
            assembly=assembly,
        )

        plan_tool.additional_properties = d
        return plan_tool

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
