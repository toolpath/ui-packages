from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Literal, TypeVar, cast

from attrs import define as _attrs_define

T = TypeVar("T", bound="TurnedOutlineFacts")


@_attrs_define
class TurnedOutlineFacts:
    """A feature with no measurements of its own: `OdProfile`, `FaceProfile` or
    `IdProfile`. Its datasheet's bounds and slopes say what it asks of
    a tool.

        Attributes:
            kind (Literal['FaceProfile'] | Literal['IdProfile'] | Literal['OdProfile']): Discriminant of a
                `TurnedFeatureFacts`: the feature's type.
    """

    kind: Literal["FaceProfile"] | Literal["IdProfile"] | Literal["OdProfile"]

    def to_dict(self) -> dict[str, Any]:
        kind: Literal["FaceProfile"] | Literal["IdProfile"] | Literal["OdProfile"]
        kind = self.kind

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "kind": kind,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)

        def _parse_kind(data: object) -> Literal["FaceProfile"] | Literal["IdProfile"] | Literal["OdProfile"]:
            kind_type_0 = cast(Literal["OdProfile"], data)
            if kind_type_0 != "OdProfile":
                raise ValueError(f"kind_type_0 must match const 'OdProfile', got '{kind_type_0}'")
            return kind_type_0
            kind_type_1 = cast(Literal["FaceProfile"], data)
            if kind_type_1 != "FaceProfile":
                raise ValueError(f"kind_type_1 must match const 'FaceProfile', got '{kind_type_1}'")
            return kind_type_1
            kind_type_2 = cast(Literal["IdProfile"], data)
            if kind_type_2 != "IdProfile":
                raise ValueError(f"kind_type_2 must match const 'IdProfile', got '{kind_type_2}'")
            return kind_type_2

        kind = _parse_kind(d.pop("kind"))

        turned_outline_facts = cls(
            kind=kind,
        )

        return turned_outline_facts
