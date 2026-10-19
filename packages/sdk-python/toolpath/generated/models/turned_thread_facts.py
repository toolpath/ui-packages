from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Literal, TypeVar, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.thread_spec import ThreadSpec


T = TypeVar("T", bound="TurnedThreadFacts")


@_attrs_define
class TurnedThreadFacts:
    """A thread.

    Attributes:
        kind (Literal['IdThread'] | Literal['OdThread']): Discriminant of the facts union: the feature's type.
        pitch (float): In mm.
        depth (float): Thread depth, in mm.
        thread_spec (ThreadSpec | Unset): The thread a hole is to receive.

            Every diameter, the pitch and `threadPercentage` are finite and positive,
            `threadPercentage` at most 100, `minMinorDiameter` no more than `maxMinorDiameter`, and
            `minMajorDiameter` above `minMinorDiameter`; the two angles keep the ranges their fields
            state.
    """

    kind: Literal["IdThread"] | Literal["OdThread"]
    pitch: float
    depth: float
    thread_spec: ThreadSpec | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        kind: Literal["IdThread"] | Literal["OdThread"]
        kind = self.kind

        pitch = self.pitch

        depth = self.depth

        thread_spec: dict[str, Any] | Unset = UNSET
        if not isinstance(self.thread_spec, Unset):
            thread_spec = self.thread_spec.to_dict()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "kind": kind,
                "pitch": pitch,
                "depth": depth,
            }
        )
        if thread_spec is not UNSET:
            field_dict["threadSpec"] = thread_spec

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.thread_spec import ThreadSpec

        d = dict(src_dict)

        def _parse_kind(data: object) -> Literal["IdThread"] | Literal["OdThread"]:
            kind_type_0 = cast(Literal["OdThread"], data)
            if kind_type_0 != "OdThread":
                raise ValueError(f"kind_type_0 must match const 'OdThread', got '{kind_type_0}'")
            return kind_type_0
            kind_type_1 = cast(Literal["IdThread"], data)
            if kind_type_1 != "IdThread":
                raise ValueError(f"kind_type_1 must match const 'IdThread', got '{kind_type_1}'")
            return kind_type_1

        kind = _parse_kind(d.pop("kind"))

        pitch = d.pop("pitch")

        depth = d.pop("depth")

        _thread_spec = d.pop("threadSpec", UNSET)
        thread_spec: ThreadSpec | Unset
        if isinstance(_thread_spec, Unset):
            thread_spec = UNSET
        else:
            thread_spec = ThreadSpec.from_dict(_thread_spec)

        turned_thread_facts = cls(
            kind=kind,
            pitch=pitch,
            depth=depth,
            thread_spec=thread_spec,
        )

        return turned_thread_facts
