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
        needs_sidemill (bool): Deprecated: sweeping the floor does not clear the face on its own, so a wall pass must
            follow. tp-kernel 0.11.0 no longer states it separately, since only a face that is not faced off asks its tool
            to cut on its flank: a feature enriched since reads `!isFacing`. Removed in the next API major.
        max_bottom_diameter (float | None): Deprecated: the largest bottom diameter a terminal tool may have. Nothing
            ever computed it, so it has always read `null`, and tp-kernel 0.16.0 removed it. Removed in the next API major.
    """

    kind: Literal["Face"]
    is_top_face: bool
    is_facing: bool
    cd: CdData
    needs_sidemill: bool
    max_bottom_diameter: float | None

    def to_dict(self) -> dict[str, Any]:
        kind = self.kind

        is_top_face = self.is_top_face

        is_facing = self.is_facing

        cd = self.cd.to_dict()

        needs_sidemill = self.needs_sidemill

        max_bottom_diameter: float | None
        max_bottom_diameter = self.max_bottom_diameter

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "kind": kind,
                "isTopFace": is_top_face,
                "isFacing": is_facing,
                "cd": cd,
                "needsSidemill": needs_sidemill,
                "maxBottomDiameter": max_bottom_diameter,
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

        needs_sidemill = d.pop("needsSidemill")

        def _parse_max_bottom_diameter(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        max_bottom_diameter = _parse_max_bottom_diameter(d.pop("maxBottomDiameter"))

        face_facts = cls(
            kind=kind,
            is_top_face=is_top_face,
            is_facing=is_facing,
            cd=cd,
            needs_sidemill=needs_sidemill,
            max_bottom_diameter=max_bottom_diameter,
        )

        return face_facts
