from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.vec_3 import Vec3


T = TypeVar("T", bound="TrimmedFeature")


@_attrs_define
class TrimmedFeature:
    """A feature of the part as a plan reads it that the part report does not list, whether or not a setup names it: what
    the plan’s skipped regions (done, or left at size by its stock body), or the features its `setupPlan` names, left of
    a part feature, which the kernel reads again on the rest of its regions under a tag of its own.

        Attributes:
            feature_tag (str): Kernel feature tag (hex) the plan reads this feature under. `GET /v1/parts/{id}` lists no
                feature under it.
            feature_type (str): What the rest of the part feature reads as, in snake_case as a part feature’s `featureType`
                is: a pocket whose floor is done may read as a wall. This vocabulary is open-ended.
            machining_direction (Vec3):
            region_idxs (list[int]): Indexes of the regions it holds, ascending; join each value to the part report’s
                `regions[].idx`. None is a region the plan skips.
            from_feature_tag (None | str): The `featureTag` of the part feature it was cut from, which holds every one of
                its regions, and also the ones cut away from it. Null where no one part feature does.
    """

    feature_tag: str
    feature_type: str
    machining_direction: Vec3
    region_idxs: list[int]
    from_feature_tag: None | str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        feature_tag = self.feature_tag

        feature_type = self.feature_type

        machining_direction = self.machining_direction.to_dict()

        region_idxs = self.region_idxs

        from_feature_tag: None | str
        from_feature_tag = self.from_feature_tag

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "featureTag": feature_tag,
                "featureType": feature_type,
                "machiningDirection": machining_direction,
                "regionIdxs": region_idxs,
                "fromFeatureTag": from_feature_tag,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.vec_3 import Vec3

        d = dict(src_dict)
        feature_tag = d.pop("featureTag")

        feature_type = d.pop("featureType")

        machining_direction = Vec3.from_dict(d.pop("machiningDirection"))

        region_idxs = cast(list[int], d.pop("regionIdxs"))

        def _parse_from_feature_tag(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        from_feature_tag = _parse_from_feature_tag(d.pop("fromFeatureTag"))

        trimmed_feature = cls(
            feature_tag=feature_tag,
            feature_type=feature_type,
            machining_direction=machining_direction,
            region_idxs=region_idxs,
            from_feature_tag=from_feature_tag,
        )

        trimmed_feature.additional_properties = d
        return trimmed_feature

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
