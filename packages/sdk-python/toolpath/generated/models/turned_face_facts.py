from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Literal, TypeVar, cast

from attrs import define as _attrs_define

T = TypeVar("T", bound="TurnedFaceFacts")


@_attrs_define
class TurnedFaceFacts:
    """A face square to the axis.

    Attributes:
        kind (Literal['Face']): Discriminant of the facts union; always `'Face'` here.
        z (float): Where it stands along the axis, in mm. It looks toward the end it is cut from, its
            feature's `approach`.
    """

    kind: Literal["Face"]
    z: float

    def to_dict(self) -> dict[str, Any]:
        kind = self.kind

        z = self.z

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "kind": kind,
                "z": z,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = cast(Literal["Face"], d.pop("kind"))
        if kind != "Face":
            raise ValueError(f"kind must match const 'Face', got '{kind}'")

        z = d.pop("z")

        turned_face_facts = cls(
            kind=kind,
            z=z,
        )

        return turned_face_facts
