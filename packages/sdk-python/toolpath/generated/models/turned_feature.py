from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.axial_direction import AxialDirection
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.turning_datasheet import TurningDatasheet


T = TypeVar("T", bound="TurnedFeature")


@_attrs_define
class TurnedFeature:
    """A stretch of a turned part’s outline, as cut from one end, and what it is.

    Attributes:
        feature_tag (str): Kernel turned-feature tag, encoded as a lowercase hexadecimal string. Stable across runs of
            one kernel version, not across versions. Hashed apart from a milled feature’s `featureTag`.
        feature_type (str): What it is, in snake_case (`od_groove`): its datasheet’s `featureType`, cased as a milled
            feature’s is. This vocabulary is open-ended.
        region_idxs (list[int]): Indexes of the regions it was spun from, ascending; join each value to `regions[].idx`.
        datasheet (None | TurningDatasheet): Its turning datasheet, or null when the analysis ran without feature
            details or where it could not be measured — and, on reports made before Engine API 1.29.0, for an `unknown`
            feature.
        approach (AxialDirection | None | Unset): The end of the part it is cut from, whole: `PlusZ`, the end
            `frame.direction` points toward, or `MinusZ`, the other. A stretch both ends reach is two features, one per end,
            with the same `featureType` and `regionIdxs`. Null only on reports made before Engine API 1.29.0, for an
            `unknown` feature, which no cut reaches; absent on reports made before 1.26.0.
    """

    feature_tag: str
    feature_type: str
    region_idxs: list[int]
    datasheet: None | TurningDatasheet
    approach: AxialDirection | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.turning_datasheet import TurningDatasheet

        feature_tag = self.feature_tag

        feature_type = self.feature_type

        region_idxs = self.region_idxs

        datasheet: dict[str, Any] | None
        if isinstance(self.datasheet, TurningDatasheet):
            datasheet = self.datasheet.to_dict()
        else:
            datasheet = self.datasheet

        approach: None | str | Unset
        if isinstance(self.approach, Unset):
            approach = UNSET
        elif isinstance(self.approach, AxialDirection):
            approach = self.approach.value
        else:
            approach = self.approach

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "featureTag": feature_tag,
                "featureType": feature_type,
                "regionIdxs": region_idxs,
                "datasheet": datasheet,
            }
        )
        if approach is not UNSET:
            field_dict["approach"] = approach

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.turning_datasheet import TurningDatasheet

        d = dict(src_dict)
        feature_tag = d.pop("featureTag")

        feature_type = d.pop("featureType")

        region_idxs = cast(list[int], d.pop("regionIdxs"))

        def _parse_datasheet(data: object) -> None | TurningDatasheet:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                datasheet_type_0 = TurningDatasheet.from_dict(data)

                return datasheet_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | TurningDatasheet, data)

        datasheet = _parse_datasheet(d.pop("datasheet"))

        def _parse_approach(data: object) -> AxialDirection | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                approach_type_0 = AxialDirection(data)

                return approach_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(AxialDirection | None | Unset, data)

        approach = _parse_approach(d.pop("approach", UNSET))

        turned_feature = cls(
            feature_tag=feature_tag,
            feature_type=feature_type,
            region_idxs=region_idxs,
            datasheet=datasheet,
            approach=approach,
        )

        turned_feature.additional_properties = d
        return turned_feature

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
