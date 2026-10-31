from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Literal, TypeVar, cast

from attrs import define as _attrs_define

if TYPE_CHECKING:
    from ..models.bevel_facts import BevelFacts
    from ..models.surface_facts import SurfaceFacts


T = TypeVar("T", bound="ChamferFacts")


@_attrs_define
class ChamferFacts:
    """A chamfer, which is two things at once and carries a measurement of each: a bevel
    cut by a cone's flank, and a surface a ball can follow. Which one a given tool
    answers to is settled by the tool's own shape.

        Attributes:
            kind (Literal['Chamfer']): Discriminant of a `FeatureFacts`; always `'Chamfer'` here.
            bevel (BevelFacts): The bevel half of a chamfer: how it leans, how far it runs, and where its surroundings
                let a cone ride it.
            three (SurfaceFacts): A three-dimensional surface a tool has to follow rather than sweep; also the surface
                half of a chamfer.
    """

    kind: Literal["Chamfer"]
    bevel: BevelFacts
    three: SurfaceFacts

    def to_dict(self) -> dict[str, Any]:
        kind = self.kind

        bevel = self.bevel.to_dict()

        three = self.three.to_dict()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "kind": kind,
                "bevel": bevel,
                "three": three,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.bevel_facts import BevelFacts
        from ..models.surface_facts import SurfaceFacts

        d = dict(src_dict)
        kind = cast(Literal["Chamfer"], d.pop("kind"))
        if kind != "Chamfer":
            raise ValueError(f"kind must match const 'Chamfer', got '{kind}'")

        bevel = BevelFacts.from_dict(d.pop("bevel"))

        three = SurfaceFacts.from_dict(d.pop("three"))

        chamfer_facts = cls(
            kind=kind,
            bevel=bevel,
            three=three,
        )

        return chamfer_facts
