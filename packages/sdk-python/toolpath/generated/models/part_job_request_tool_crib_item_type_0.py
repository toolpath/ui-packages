from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define

from ..models.part_job_request_tool_crib_item_type_0_kind import PartJobRequestToolCribItemType0Kind
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.part_job_request_tool_crib_item_type_0_ball_endmill import PartJobRequestToolCribItemType0BallEndmill
    from ..models.part_job_request_tool_crib_item_type_0_bull_nose import PartJobRequestToolCribItemType0BullNose
    from ..models.part_job_request_tool_crib_item_type_0_chamfer import PartJobRequestToolCribItemType0Chamfer
    from ..models.part_job_request_tool_crib_item_type_0_corner_rounding import (
        PartJobRequestToolCribItemType0CornerRounding,
    )
    from ..models.part_job_request_tool_crib_item_type_0_drill import PartJobRequestToolCribItemType0Drill
    from ..models.part_job_request_tool_crib_item_type_0_face_mill import PartJobRequestToolCribItemType0FaceMill
    from ..models.part_job_request_tool_crib_item_type_0_flat_endmill import PartJobRequestToolCribItemType0FlatEndmill
    from ..models.part_job_request_tool_crib_item_type_0_keyseat import PartJobRequestToolCribItemType0Keyseat
    from ..models.part_job_request_tool_crib_item_type_0_tap import PartJobRequestToolCribItemType0Tap


T = TypeVar("T", bound="PartJobRequestToolCribItemType0")


@_attrs_define
class PartJobRequestToolCribItemType0:
    """
    Attributes:
        kind (PartJobRequestToolCribItemType0Kind):
        name (str | Unset):
        face_mill (PartJobRequestToolCribItemType0FaceMill | Unset):
        flat_endmill (PartJobRequestToolCribItemType0FlatEndmill | Unset):
        bull_nose (PartJobRequestToolCribItemType0BullNose | Unset):
        ball_endmill (PartJobRequestToolCribItemType0BallEndmill | Unset):
        drill (PartJobRequestToolCribItemType0Drill | Unset):
        chamfer (PartJobRequestToolCribItemType0Chamfer | Unset):
        keyseat (PartJobRequestToolCribItemType0Keyseat | Unset):
        tap (PartJobRequestToolCribItemType0Tap | Unset):
        corner_rounding (PartJobRequestToolCribItemType0CornerRounding | Unset):
    """

    kind: PartJobRequestToolCribItemType0Kind
    name: str | Unset = UNSET
    face_mill: PartJobRequestToolCribItemType0FaceMill | Unset = UNSET
    flat_endmill: PartJobRequestToolCribItemType0FlatEndmill | Unset = UNSET
    bull_nose: PartJobRequestToolCribItemType0BullNose | Unset = UNSET
    ball_endmill: PartJobRequestToolCribItemType0BallEndmill | Unset = UNSET
    drill: PartJobRequestToolCribItemType0Drill | Unset = UNSET
    chamfer: PartJobRequestToolCribItemType0Chamfer | Unset = UNSET
    keyseat: PartJobRequestToolCribItemType0Keyseat | Unset = UNSET
    tap: PartJobRequestToolCribItemType0Tap | Unset = UNSET
    corner_rounding: PartJobRequestToolCribItemType0CornerRounding | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        kind = self.kind.value

        name = self.name

        face_mill: dict[str, Any] | Unset = UNSET
        if not isinstance(self.face_mill, Unset):
            face_mill = self.face_mill.to_dict()

        flat_endmill: dict[str, Any] | Unset = UNSET
        if not isinstance(self.flat_endmill, Unset):
            flat_endmill = self.flat_endmill.to_dict()

        bull_nose: dict[str, Any] | Unset = UNSET
        if not isinstance(self.bull_nose, Unset):
            bull_nose = self.bull_nose.to_dict()

        ball_endmill: dict[str, Any] | Unset = UNSET
        if not isinstance(self.ball_endmill, Unset):
            ball_endmill = self.ball_endmill.to_dict()

        drill: dict[str, Any] | Unset = UNSET
        if not isinstance(self.drill, Unset):
            drill = self.drill.to_dict()

        chamfer: dict[str, Any] | Unset = UNSET
        if not isinstance(self.chamfer, Unset):
            chamfer = self.chamfer.to_dict()

        keyseat: dict[str, Any] | Unset = UNSET
        if not isinstance(self.keyseat, Unset):
            keyseat = self.keyseat.to_dict()

        tap: dict[str, Any] | Unset = UNSET
        if not isinstance(self.tap, Unset):
            tap = self.tap.to_dict()

        corner_rounding: dict[str, Any] | Unset = UNSET
        if not isinstance(self.corner_rounding, Unset):
            corner_rounding = self.corner_rounding.to_dict()

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "kind": kind,
            }
        )
        if name is not UNSET:
            field_dict["name"] = name
        if face_mill is not UNSET:
            field_dict["faceMill"] = face_mill
        if flat_endmill is not UNSET:
            field_dict["flatEndmill"] = flat_endmill
        if bull_nose is not UNSET:
            field_dict["bullNose"] = bull_nose
        if ball_endmill is not UNSET:
            field_dict["ballEndmill"] = ball_endmill
        if drill is not UNSET:
            field_dict["drill"] = drill
        if chamfer is not UNSET:
            field_dict["chamfer"] = chamfer
        if keyseat is not UNSET:
            field_dict["keyseat"] = keyseat
        if tap is not UNSET:
            field_dict["tap"] = tap
        if corner_rounding is not UNSET:
            field_dict["cornerRounding"] = corner_rounding

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.part_job_request_tool_crib_item_type_0_ball_endmill import (
            PartJobRequestToolCribItemType0BallEndmill,
        )
        from ..models.part_job_request_tool_crib_item_type_0_bull_nose import PartJobRequestToolCribItemType0BullNose
        from ..models.part_job_request_tool_crib_item_type_0_chamfer import PartJobRequestToolCribItemType0Chamfer
        from ..models.part_job_request_tool_crib_item_type_0_corner_rounding import (
            PartJobRequestToolCribItemType0CornerRounding,
        )
        from ..models.part_job_request_tool_crib_item_type_0_drill import PartJobRequestToolCribItemType0Drill
        from ..models.part_job_request_tool_crib_item_type_0_face_mill import PartJobRequestToolCribItemType0FaceMill
        from ..models.part_job_request_tool_crib_item_type_0_flat_endmill import (
            PartJobRequestToolCribItemType0FlatEndmill,
        )
        from ..models.part_job_request_tool_crib_item_type_0_keyseat import PartJobRequestToolCribItemType0Keyseat
        from ..models.part_job_request_tool_crib_item_type_0_tap import PartJobRequestToolCribItemType0Tap

        d = dict(src_dict)
        kind = PartJobRequestToolCribItemType0Kind(d.pop("kind"))

        name = d.pop("name", UNSET)

        _face_mill = d.pop("faceMill", UNSET)
        face_mill: PartJobRequestToolCribItemType0FaceMill | Unset
        if isinstance(_face_mill, Unset):
            face_mill = UNSET
        else:
            face_mill = PartJobRequestToolCribItemType0FaceMill.from_dict(_face_mill)

        _flat_endmill = d.pop("flatEndmill", UNSET)
        flat_endmill: PartJobRequestToolCribItemType0FlatEndmill | Unset
        if isinstance(_flat_endmill, Unset):
            flat_endmill = UNSET
        else:
            flat_endmill = PartJobRequestToolCribItemType0FlatEndmill.from_dict(_flat_endmill)

        _bull_nose = d.pop("bullNose", UNSET)
        bull_nose: PartJobRequestToolCribItemType0BullNose | Unset
        if isinstance(_bull_nose, Unset):
            bull_nose = UNSET
        else:
            bull_nose = PartJobRequestToolCribItemType0BullNose.from_dict(_bull_nose)

        _ball_endmill = d.pop("ballEndmill", UNSET)
        ball_endmill: PartJobRequestToolCribItemType0BallEndmill | Unset
        if isinstance(_ball_endmill, Unset):
            ball_endmill = UNSET
        else:
            ball_endmill = PartJobRequestToolCribItemType0BallEndmill.from_dict(_ball_endmill)

        _drill = d.pop("drill", UNSET)
        drill: PartJobRequestToolCribItemType0Drill | Unset
        if isinstance(_drill, Unset):
            drill = UNSET
        else:
            drill = PartJobRequestToolCribItemType0Drill.from_dict(_drill)

        _chamfer = d.pop("chamfer", UNSET)
        chamfer: PartJobRequestToolCribItemType0Chamfer | Unset
        if isinstance(_chamfer, Unset):
            chamfer = UNSET
        else:
            chamfer = PartJobRequestToolCribItemType0Chamfer.from_dict(_chamfer)

        _keyseat = d.pop("keyseat", UNSET)
        keyseat: PartJobRequestToolCribItemType0Keyseat | Unset
        if isinstance(_keyseat, Unset):
            keyseat = UNSET
        else:
            keyseat = PartJobRequestToolCribItemType0Keyseat.from_dict(_keyseat)

        _tap = d.pop("tap", UNSET)
        tap: PartJobRequestToolCribItemType0Tap | Unset
        if isinstance(_tap, Unset):
            tap = UNSET
        else:
            tap = PartJobRequestToolCribItemType0Tap.from_dict(_tap)

        _corner_rounding = d.pop("cornerRounding", UNSET)
        corner_rounding: PartJobRequestToolCribItemType0CornerRounding | Unset
        if isinstance(_corner_rounding, Unset):
            corner_rounding = UNSET
        else:
            corner_rounding = PartJobRequestToolCribItemType0CornerRounding.from_dict(_corner_rounding)

        part_job_request_tool_crib_item_type_0 = cls(
            kind=kind,
            name=name,
            face_mill=face_mill,
            flat_endmill=flat_endmill,
            bull_nose=bull_nose,
            ball_endmill=ball_endmill,
            drill=drill,
            chamfer=chamfer,
            keyseat=keyseat,
            tap=tap,
            corner_rounding=corner_rounding,
        )

        return part_job_request_tool_crib_item_type_0
