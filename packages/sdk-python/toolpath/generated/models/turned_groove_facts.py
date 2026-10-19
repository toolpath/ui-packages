from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Literal, TypeVar, cast

from attrs import define as _attrs_define

T = TypeVar("T", bound="TurnedGrooveFacts")


@_attrs_define
class TurnedGrooveFacts:
    """A groove cut radially, into the outside or into a hole's wall.

    Attributes:
        kind (Literal['IdGroove'] | Literal['OdGroove']): Discriminant of the facts union: the feature's type.
        width (float): Its extent along the axis, in mm.
        depth (float): How far it goes in radially, in mm.
    """

    kind: Literal["IdGroove"] | Literal["OdGroove"]
    width: float
    depth: float

    def to_dict(self) -> dict[str, Any]:
        kind: Literal["IdGroove"] | Literal["OdGroove"]
        kind = self.kind

        width = self.width

        depth = self.depth

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "kind": kind,
                "width": width,
                "depth": depth,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)

        def _parse_kind(data: object) -> Literal["IdGroove"] | Literal["OdGroove"]:
            kind_type_0 = cast(Literal["OdGroove"], data)
            if kind_type_0 != "OdGroove":
                raise ValueError(f"kind_type_0 must match const 'OdGroove', got '{kind_type_0}'")
            return kind_type_0
            kind_type_1 = cast(Literal["IdGroove"], data)
            if kind_type_1 != "IdGroove":
                raise ValueError(f"kind_type_1 must match const 'IdGroove', got '{kind_type_1}'")
            return kind_type_1

        kind = _parse_kind(d.pop("kind"))

        width = d.pop("width")

        depth = d.pop("depth")

        turned_groove_facts = cls(
            kind=kind,
            width=width,
            depth=depth,
        )

        return turned_groove_facts
