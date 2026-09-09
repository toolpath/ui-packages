from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Literal, TypeVar, cast

from attrs import define as _attrs_define

if TYPE_CHECKING:
    from ..models.cd_data import CdData


T = TypeVar("T", bound="FaceFacts")


@_attrs_define
class FaceFacts:
    """A face: a plane square to the tool axis, cleared by sweeping across it.

    Attributes:
        kind (Literal['Face']): Discriminator for this facts variant.
        is_top_face (bool): The face is the highest surface of the part along the tool axis.
        is_facing (bool): The face is to be faced off: a top face the fixture does not rule out.
        cd (CdData): Clearance-diameter bounds per tolerance regime, plus the flags derived with them.
        max_bottom_diameter (float): Largest bottom diameter a terminal tool may have, in mm.
        needs_sidemill (bool): Deprecated: sweeping the floor does not clear the face on its own, so a wall pass must
            follow. tp-kernel 0.11.0 no longer states it separately, since only a face that is not faced off asks its tool
            to cut on its flank: a feature enriched since reads `!isFacing`. Removed in the next API major.
    """

    kind: Literal["Face"]
    is_top_face: bool
    is_facing: bool
    cd: CdData
    max_bottom_diameter: float
    needs_sidemill: bool

    def to_dict(self) -> dict[str, Any]:
        kind = self.kind

        is_top_face = self.is_top_face

        is_facing = self.is_facing

        cd = self.cd.to_dict()

        max_bottom_diameter = self.max_bottom_diameter

        needs_sidemill = self.needs_sidemill

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "kind": kind,
                "isTopFace": is_top_face,
                "isFacing": is_facing,
                "cd": cd,
                "maxBottomDiameter": max_bottom_diameter,
                "needsSidemill": needs_sidemill,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.cd_data import CdData

        d = dict(src_dict)
        kind = cast(Literal["Face"], d.pop("kind"))
        if kind != "Face":
            raise ValueError(f"kind must match const 'Face', got '{kind}'")

        is_top_face = d.pop("isTopFace")

        is_facing = d.pop("isFacing")

        cd = CdData.from_dict(d.pop("cd"))

        max_bottom_diameter = d.pop("maxBottomDiameter")

        needs_sidemill = d.pop("needsSidemill")

        face_facts = cls(
            kind=kind,
            is_top_face=is_top_face,
            is_facing=is_facing,
            cd=cd,
            max_bottom_diameter=max_bottom_diameter,
            needs_sidemill=needs_sidemill,
        )

        return face_facts
