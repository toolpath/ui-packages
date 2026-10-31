from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Literal, TypeVar, cast

from attrs import define as _attrs_define

T = TypeVar("T", bound="TurnedFaceGrooveFacts")


@_attrs_define
class TurnedFaceGrooveFacts:
    """A groove cut axially into a face.

    Attributes:
        kind (Literal['FaceGroove']): Discriminant of a `TurnedFeatureFacts`; always `'FaceGroove'` here.
        width (float): Its extent across the axis, in mm.
        depth (float): How far it goes in along the axis, in mm, from a face that looks toward the end it
            is cut from, its feature's `approach`.
    """

    kind: Literal["FaceGroove"]
    width: float
    depth: float

    def to_dict(self) -> dict[str, Any]:
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
        kind = cast(Literal["FaceGroove"], d.pop("kind"))
        if kind != "FaceGroove":
            raise ValueError(f"kind must match const 'FaceGroove', got '{kind}'")

        width = d.pop("width")

        depth = d.pop("depth")

        turned_face_groove_facts = cls(
            kind=kind,
            width=width,
            depth=depth,
        )

        return turned_face_groove_facts
