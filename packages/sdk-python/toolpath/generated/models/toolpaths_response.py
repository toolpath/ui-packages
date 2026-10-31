from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.toolpath_setup import ToolpathSetup


T = TypeVar("T", bound="ToolpathsResponse")


@_attrs_define
class ToolpathsResponse:
    """
    Attributes:
        part_id (UUID): Identifier of this part.
        plan_id (UUID): Identifier of the plan.
        job_id (UUID): Identifier of the job that produced these toolpaths.
        kernel_version (str): Version of the Toolpath kernel that produced these toolpaths.
        setups (list[ToolpathSetup]): Setups, in machining order.
        initial_stock_url (None | str): 15-minute URL for the exact initial stock mesh (GLB, part coordinates, mm),
            before the first action. Null when unavailable; fall back to the plan’s stock.resolved figure. A plain GLB, like
            `meshGlbUrl`: no glTF extension is needed to read it. It is stored gzipped and served with `Content-Encoding:
            gzip` whatever the request’s `Accept-Encoding`: browsers and `fetch` undo that on their own, but curl without
            `--compressed`, wget, Python’s `urllib`, and Java’s and .NET’s HTTP clients by default hand back the gzipped
            bytes, which must be gunzipped before the GLB is parsed.
        cam_export_url (None | str): 15-minute URL for the CAM export: a zip another CAM system rebuilds this job from
            in its own operations. `job.json` states the tools, the features, the setups in machining order and each action
            as its intent, tool, heights, feeds and the strategy the plan decided, a refused action with its reason; beside
            it are the part and the faces each action machines as STEP, and each calculated action’s toolpath as binary
            columns. Its format may change in any release. Null for a plan calculated before 1.37.0, and where the export is
            unavailable — one of its toolpaths tilts the tool, which it cannot state. **Experimental.** Available now and
            still gaining functionality. It may change in breaking ways in a minor API release; each such change is listed
            in the release notes, so check them before upgrading.
    """

    part_id: UUID
    plan_id: UUID
    job_id: UUID
    kernel_version: str
    setups: list[ToolpathSetup]
    initial_stock_url: None | str
    cam_export_url: None | str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        part_id = str(self.part_id)

        plan_id = str(self.plan_id)

        job_id = str(self.job_id)

        kernel_version = self.kernel_version

        setups = []
        for setups_item_data in self.setups:
            setups_item = setups_item_data.to_dict()
            setups.append(setups_item)

        initial_stock_url: None | str
        initial_stock_url = self.initial_stock_url

        cam_export_url: None | str
        cam_export_url = self.cam_export_url

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "partId": part_id,
                "planId": plan_id,
                "jobId": job_id,
                "kernelVersion": kernel_version,
                "setups": setups,
                "initialStockUrl": initial_stock_url,
                "camExportUrl": cam_export_url,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.toolpath_setup import ToolpathSetup

        d = dict(src_dict)
        part_id = UUID(d.pop("partId"))

        plan_id = UUID(d.pop("planId"))

        job_id = UUID(d.pop("jobId"))

        kernel_version = d.pop("kernelVersion")

        setups = []
        _setups = d.pop("setups")
        for setups_item_data in _setups:
            setups_item = ToolpathSetup.from_dict(setups_item_data)

            setups.append(setups_item)

        def _parse_initial_stock_url(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        initial_stock_url = _parse_initial_stock_url(d.pop("initialStockUrl"))

        def _parse_cam_export_url(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        cam_export_url = _parse_cam_export_url(d.pop("camExportUrl"))

        toolpaths_response = cls(
            part_id=part_id,
            plan_id=plan_id,
            job_id=job_id,
            kernel_version=kernel_version,
            setups=setups,
            initial_stock_url=initial_stock_url,
            cam_export_url=cam_export_url,
        )

        toolpaths_response.additional_properties = d
        return toolpaths_response

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
