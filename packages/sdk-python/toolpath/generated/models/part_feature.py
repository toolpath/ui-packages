from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.vec_3 import Vec3


T = TypeVar("T", bound="PartFeature")


@_attrs_define
class PartFeature:
    """
    Attributes:
        feature_id (UUID): Globally unique identifier of this feature record within its part result.
        feature_tag (str): Kernel feature tag, encoded as a lowercase hexadecimal string. Stable across runs of one
            kernel version, not across versions.
        region_idxs (list[int]): Indexes of regions this feature covers; join each value to `regions[].idx`.
        feature_type (str): Kernel-recognized feature type. This vocabulary is open-ended as the kernel evolves.
        machining_direction (Vec3):
        axis (None | Vec3): Deprecated: use `machiningDirection`, which this repeats. Removed in the next API major.
    """

    feature_id: UUID
    feature_tag: str
    region_idxs: list[int]
    feature_type: str
    machining_direction: Vec3
    axis: None | Vec3
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.vec_3 import Vec3

        feature_id = str(self.feature_id)

        feature_tag = self.feature_tag

        region_idxs = self.region_idxs

        feature_type = self.feature_type

        machining_direction = self.machining_direction.to_dict()

        axis: dict[str, Any] | None
        if isinstance(self.axis, Vec3):
            axis = self.axis.to_dict()
        else:
            axis = self.axis

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "featureId": feature_id,
                "featureTag": feature_tag,
                "regionIdxs": region_idxs,
                "featureType": feature_type,
                "machiningDirection": machining_direction,
                "axis": axis,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.vec_3 import Vec3

        d = dict(src_dict)
        feature_id = UUID(d.pop("featureId"))

        feature_tag = d.pop("featureTag")

        region_idxs = cast(list[int], d.pop("regionIdxs"))

        feature_type = d.pop("featureType")

        machining_direction = Vec3.from_dict(d.pop("machiningDirection"))

        def _parse_axis(data: object) -> None | Vec3:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                axis_type_0 = Vec3.from_dict(data)

                return axis_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Vec3, data)

        axis = _parse_axis(d.pop("axis"))

        part_feature = cls(
            feature_id=feature_id,
            feature_tag=feature_tag,
            region_idxs=region_idxs,
            feature_type=feature_type,
            machining_direction=machining_direction,
            axis=axis,
        )

        part_feature.additional_properties = d
        return part_feature

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
