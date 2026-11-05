from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.contour_arc import ContourArc
    from ..models.contour_segment import ContourSegment
    from ..models.feature_datasheet import FeatureDatasheet
    from ..models.part_feature_entry_tool_frame_type_0 import PartFeatureEntryToolFrameType0


T = TypeVar("T", bound="PartFeatureEntry")


@_attrs_define
class PartFeatureEntry:
    """
    Attributes:
        feature_id (UUID): Identifier of the resolved feature.
        feature_tag (str): Kernel feature tag, encoded as a lowercase hexadecimal string. Stable across runs of one
            kernel version, not across versions.
        feature_type (str): Kernel-recognized feature type; the vocabulary is open-ended.
        datasheet (FeatureDatasheet | None): Generated machining detail, or null when this feature has no detail yet.
        contours (list[list[ContourArc | ContourSegment]] | None | Unset): The feature’s plan-view outline, returned
            with `include=contours`: loops of exact segments and arcs, as x and y in mm in `toolFrame`, the frame its
            datasheet’s heights are in. A closed loop no other holds runs counterclockwise and an island inside one
            clockwise; a wall’s loops keep the material on their left. Empty for a feature with none — a hole, which is its
            circle; an undercut — and where the kernel could not project it; null where the feature has not been measured
            since Engine API 1.39.0.
        wall_contours (list[list[ContourArc | ContourSegment]] | None | Unset): An open pocket’s walls, returned with
            `include=contours`: runs in the same frame with the material on their left, whose free ends bound the pocket’s
            open sides. Empty for every other kind; null where `contours` is.
        tool_frame (None | PartFeatureEntryToolFrameType0 | Unset): The tool frame of the feature’s
            `machiningDirection`, in part coordinates, returned with `include=contours`: its axis is the direction and its x
            axis level. A contour point `(x, y)` at height `z` sits at `location + x·refDirection + y·(axis × refDirection)
            + z·axis` on the part. Null where `contours` is.
    """

    feature_id: UUID
    feature_tag: str
    feature_type: str
    datasheet: FeatureDatasheet | None
    contours: list[list[ContourArc | ContourSegment]] | None | Unset = UNSET
    wall_contours: list[list[ContourArc | ContourSegment]] | None | Unset = UNSET
    tool_frame: None | PartFeatureEntryToolFrameType0 | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.contour_segment import ContourSegment
        from ..models.feature_datasheet import FeatureDatasheet
        from ..models.part_feature_entry_tool_frame_type_0 import PartFeatureEntryToolFrameType0

        feature_id = str(self.feature_id)

        feature_tag = self.feature_tag

        feature_type = self.feature_type

        datasheet: dict[str, Any] | None
        if isinstance(self.datasheet, FeatureDatasheet):
            datasheet = self.datasheet.to_dict()
        else:
            datasheet = self.datasheet

        contours: list[list[dict[str, Any]]] | None | Unset
        if isinstance(self.contours, Unset):
            contours = UNSET
        elif isinstance(self.contours, list):
            contours = []
            for contours_type_0_item_data in self.contours:
                contours_type_0_item = []
                for contours_type_0_item_item_data in contours_type_0_item_data:
                    contours_type_0_item_item: dict[str, Any]
                    if isinstance(contours_type_0_item_item_data, ContourSegment):
                        contours_type_0_item_item = contours_type_0_item_item_data.to_dict()
                    else:
                        contours_type_0_item_item = contours_type_0_item_item_data.to_dict()

                    contours_type_0_item.append(contours_type_0_item_item)

                contours.append(contours_type_0_item)

        else:
            contours = self.contours

        wall_contours: list[list[dict[str, Any]]] | None | Unset
        if isinstance(self.wall_contours, Unset):
            wall_contours = UNSET
        elif isinstance(self.wall_contours, list):
            wall_contours = []
            for wall_contours_type_0_item_data in self.wall_contours:
                wall_contours_type_0_item = []
                for wall_contours_type_0_item_item_data in wall_contours_type_0_item_data:
                    wall_contours_type_0_item_item: dict[str, Any]
                    if isinstance(wall_contours_type_0_item_item_data, ContourSegment):
                        wall_contours_type_0_item_item = wall_contours_type_0_item_item_data.to_dict()
                    else:
                        wall_contours_type_0_item_item = wall_contours_type_0_item_item_data.to_dict()

                    wall_contours_type_0_item.append(wall_contours_type_0_item_item)

                wall_contours.append(wall_contours_type_0_item)

        else:
            wall_contours = self.wall_contours

        tool_frame: dict[str, Any] | None | Unset
        if isinstance(self.tool_frame, Unset):
            tool_frame = UNSET
        elif isinstance(self.tool_frame, PartFeatureEntryToolFrameType0):
            tool_frame = self.tool_frame.to_dict()
        else:
            tool_frame = self.tool_frame

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "featureId": feature_id,
                "featureTag": feature_tag,
                "featureType": feature_type,
                "datasheet": datasheet,
            }
        )
        if contours is not UNSET:
            field_dict["contours"] = contours
        if wall_contours is not UNSET:
            field_dict["wallContours"] = wall_contours
        if tool_frame is not UNSET:
            field_dict["toolFrame"] = tool_frame

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.contour_arc import ContourArc
        from ..models.contour_segment import ContourSegment
        from ..models.feature_datasheet import FeatureDatasheet
        from ..models.part_feature_entry_tool_frame_type_0 import PartFeatureEntryToolFrameType0

        d = dict(src_dict)
        feature_id = UUID(d.pop("featureId"))

        feature_tag = d.pop("featureTag")

        feature_type = d.pop("featureType")

        def _parse_datasheet(data: object) -> FeatureDatasheet | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                datasheet_type_0 = FeatureDatasheet.from_dict(data)

                return datasheet_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(FeatureDatasheet | None, data)

        datasheet = _parse_datasheet(d.pop("datasheet"))

        def _parse_contours(data: object) -> list[list[ContourArc | ContourSegment]] | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                contours_type_0 = []
                _contours_type_0 = data
                for contours_type_0_item_data in _contours_type_0:
                    contours_type_0_item = []
                    _contours_type_0_item = contours_type_0_item_data
                    for contours_type_0_item_item_data in _contours_type_0_item:

                        def _parse_contours_type_0_item_item(data: object) -> ContourArc | ContourSegment:
                            try:
                                if not isinstance(data, dict):
                                    raise TypeError()
                                componentsschemas_contour_curve_type_0 = ContourSegment.from_dict(data)

                                return componentsschemas_contour_curve_type_0
                            except (TypeError, ValueError, AttributeError, KeyError):
                                pass
                            if not isinstance(data, dict):
                                raise TypeError()
                            componentsschemas_contour_curve_type_1 = ContourArc.from_dict(data)

                            return componentsschemas_contour_curve_type_1

                        contours_type_0_item_item = _parse_contours_type_0_item_item(contours_type_0_item_item_data)

                        contours_type_0_item.append(contours_type_0_item_item)

                    contours_type_0.append(contours_type_0_item)

                return contours_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[list[ContourArc | ContourSegment]] | None | Unset, data)

        contours = _parse_contours(d.pop("contours", UNSET))

        def _parse_wall_contours(data: object) -> list[list[ContourArc | ContourSegment]] | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                wall_contours_type_0 = []
                _wall_contours_type_0 = data
                for wall_contours_type_0_item_data in _wall_contours_type_0:
                    wall_contours_type_0_item = []
                    _wall_contours_type_0_item = wall_contours_type_0_item_data
                    for wall_contours_type_0_item_item_data in _wall_contours_type_0_item:

                        def _parse_wall_contours_type_0_item_item(data: object) -> ContourArc | ContourSegment:
                            try:
                                if not isinstance(data, dict):
                                    raise TypeError()
                                componentsschemas_contour_curve_type_0 = ContourSegment.from_dict(data)

                                return componentsschemas_contour_curve_type_0
                            except (TypeError, ValueError, AttributeError, KeyError):
                                pass
                            if not isinstance(data, dict):
                                raise TypeError()
                            componentsschemas_contour_curve_type_1 = ContourArc.from_dict(data)

                            return componentsschemas_contour_curve_type_1

                        wall_contours_type_0_item_item = _parse_wall_contours_type_0_item_item(
                            wall_contours_type_0_item_item_data
                        )

                        wall_contours_type_0_item.append(wall_contours_type_0_item_item)

                    wall_contours_type_0.append(wall_contours_type_0_item)

                return wall_contours_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[list[ContourArc | ContourSegment]] | None | Unset, data)

        wall_contours = _parse_wall_contours(d.pop("wallContours", UNSET))

        def _parse_tool_frame(data: object) -> None | PartFeatureEntryToolFrameType0 | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                tool_frame_type_0 = PartFeatureEntryToolFrameType0.from_dict(data)

                return tool_frame_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | PartFeatureEntryToolFrameType0 | Unset, data)

        tool_frame = _parse_tool_frame(d.pop("toolFrame", UNSET))

        part_feature_entry = cls(
            feature_id=feature_id,
            feature_tag=feature_tag,
            feature_type=feature_type,
            datasheet=datasheet,
            contours=contours,
            wall_contours=wall_contours,
            tool_frame=tool_frame,
        )

        part_feature_entry.additional_properties = d
        return part_feature_entry

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
