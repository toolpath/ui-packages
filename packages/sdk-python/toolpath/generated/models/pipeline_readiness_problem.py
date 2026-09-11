from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.pipeline_readiness_problem_job_status_type_1 import PipelineReadinessProblemJobStatusType1
from ..models.pipeline_readiness_problem_job_status_type_2_type_1 import PipelineReadinessProblemJobStatusType2Type1
from ..models.pipeline_readiness_problem_job_status_type_3_type_1 import PipelineReadinessProblemJobStatusType3Type1
from ..models.pipeline_readiness_problem_required_step import PipelineReadinessProblemRequiredStep
from ..types import UNSET, Unset

T = TypeVar("T", bound="PipelineReadinessProblem")


@_attrs_define
class PipelineReadinessProblem:
    """
    Attributes:
        type_ (str): A URI identifying the problem type. Example: https://api.toolpath.com/problems/invalid-api-key.
        title (str): A short, human-readable summary of the problem. Example: Invalid API key.
        status (int): The HTTP status code for this occurrence. Example: 401.
        code (str): A stable, machine-readable Toolpath error code. Example: invalid_api_key.
        required_step (PipelineReadinessProblemRequiredStep): The pipeline step that must run before this data is
            available.
        job_status (None | PipelineReadinessProblemJobStatusType1 | PipelineReadinessProblemJobStatusType2Type1 |
            PipelineReadinessProblemJobStatusType3Type1): State of the latest job for the required step: queued or running
            when one is in progress, failed when the last attempt failed, or null when no such job has been queued for this
            part.
        detail (str | Unset): A human-readable explanation specific to this occurrence.
        instance (str | Unset): A URI reference identifying this occurrence.
    """

    type_: str
    title: str
    status: int
    code: str
    required_step: PipelineReadinessProblemRequiredStep
    job_status: (
        None
        | PipelineReadinessProblemJobStatusType1
        | PipelineReadinessProblemJobStatusType2Type1
        | PipelineReadinessProblemJobStatusType3Type1
    )
    detail: str | Unset = UNSET
    instance: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_

        title = self.title

        status = self.status

        code = self.code

        required_step = self.required_step.value

        job_status: None | str
        if isinstance(self.job_status, PipelineReadinessProblemJobStatusType1):
            job_status = self.job_status.value
        elif isinstance(self.job_status, PipelineReadinessProblemJobStatusType2Type1):
            job_status = self.job_status.value
        elif isinstance(self.job_status, PipelineReadinessProblemJobStatusType3Type1):
            job_status = self.job_status.value
        else:
            job_status = self.job_status

        detail = self.detail

        instance = self.instance

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "type": type_,
                "title": title,
                "status": status,
                "code": code,
                "requiredStep": required_step,
                "jobStatus": job_status,
            }
        )
        if detail is not UNSET:
            field_dict["detail"] = detail
        if instance is not UNSET:
            field_dict["instance"] = instance

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = d.pop("type")

        title = d.pop("title")

        status = d.pop("status")

        code = d.pop("code")

        required_step = PipelineReadinessProblemRequiredStep(d.pop("requiredStep"))

        def _parse_job_status(
            data: object,
        ) -> (
            None
            | PipelineReadinessProblemJobStatusType1
            | PipelineReadinessProblemJobStatusType2Type1
            | PipelineReadinessProblemJobStatusType3Type1
        ):
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                job_status_type_1 = PipelineReadinessProblemJobStatusType1(data)

                return job_status_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                job_status_type_2_type_1 = PipelineReadinessProblemJobStatusType2Type1(data)

                return job_status_type_2_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                job_status_type_3_type_1 = PipelineReadinessProblemJobStatusType3Type1(data)

                return job_status_type_3_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(
                None
                | PipelineReadinessProblemJobStatusType1
                | PipelineReadinessProblemJobStatusType2Type1
                | PipelineReadinessProblemJobStatusType3Type1,
                data,
            )

        job_status = _parse_job_status(d.pop("jobStatus"))

        detail = d.pop("detail", UNSET)

        instance = d.pop("instance", UNSET)

        pipeline_readiness_problem = cls(
            type_=type_,
            title=title,
            status=status,
            code=code,
            required_step=required_step,
            job_status=job_status,
            detail=detail,
            instance=instance,
        )

        pipeline_readiness_problem.additional_properties = d
        return pipeline_readiness_problem

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
