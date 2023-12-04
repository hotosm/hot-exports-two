import { NonIdealState, Spinner } from "@blueprintjs/core";
import React, { Component } from "react";
import {
  Alert,
  Button,
  ButtonGroup,
  Col,
  Modal,
  Panel,
  Row,
  Table
} from "react-bootstrap";
import { FormattedMessage } from "react-intl";
import { connect } from "react-redux";
import axios from "axios";
import MapListView from "./MapListView";
import {
  deleteExport,
  getExport,
  getRuns,
  runExport,
  cloneExport
} from "../actions/exports";
import { selectIsLoggedIn, selectStatus, selectUsername } from "../selectors";
import {
  REQUIRES_FEATURE_SELECTION,
  exportFormatNicename,
  formatDate,
  formatDuration,
  prettyBytes
} from "./utils";
import RequirePermission from "./RequirePermission";
import { selectAuthToken } from "../selectors";

const Details = ({ exportInfo }) => {
  return (
    <Table responsive>
      <tbody>
        <tr>
          <td>
            <FormattedMessage
              id="export.description.label"
              defaultMessage="Description"
            />:
          </td>
          <td colSpan="3">
            {exportInfo.description}
          </td>
        </tr>
        <tr>
          <td>
            <FormattedMessage
              id="export.description.id"
              defaultMessage="Id"
            />:
          </td>
          <td colSpan="3">
            {exportInfo.uid}
          </td>
        </tr>
        <tr>
          <td>
            <FormattedMessage
              id="export.project.label"
              defaultMessage="Project"
            />:
          </td>
          <td colSpan="3">
            {exportInfo.event}
          </td>
        </tr>
        <tr>
          <td>
            <FormattedMessage id="export.area.label" defaultMessage="Area" />:
          </td>
          <td colSpan="3">
            <FormattedMessage
              id="export.area"
              defaultMessage="{area} sq km"
              values={{ area: exportInfo.area }}
            />
          </td>
        </tr>
        <tr>
          <td>
            <FormattedMessage
              id="export.created_at.label"
              defaultMessage="Created at"
            />:
          </td>
          <td colSpan="3">
            {formatDate(exportInfo.created_at)}
          </td>
        </tr>
        <tr>
          <td>
            <FormattedMessage
              id="export.created_by.label"
              defaultMessage="Created by"
            />:
          </td>
          <td colSpan="3">
            <a
              href={`http://www.openstreetmap.org/user/${exportInfo.user
                .username}`}
            >
              {exportInfo.user.username}
            </a>
          </td>
        </tr>
        <tr>
          <td>
            <FormattedMessage
              id="export.published.label"
              defaultMessage="Published"
            />:
          </td>
          <td colSpan="3">
            {exportInfo.published
              ? <FormattedMessage id="yes" defaultMessage="Yes" />
              : <FormattedMessage id="no" defaultMessage="No" />}
          </td>
        </tr>
        <tr>
          <td>
            <FormattedMessage
              id="export.unfiltered.label"
              defaultMessage="All OSM Data"
            />:
          </td>
          <td colSpan="3">
            {exportInfo.unfiltered
              ? <FormattedMessage id="yes" defaultMessage="Yes" />
              : <FormattedMessage id="no" defaultMessage="No" />}
          </td>
        </tr>
        <tr>
          <td>
            <FormattedMessage
              id="export.export_formats.label"
              defaultMessage="Export formats"
            />:
          </td>
          <td colSpan="3">
            <ul style={{ listStyleType: "none", padding: 0 }}>
              {exportInfo.export_formats.map((x, idx) =>
                <li key={idx}>
                  {exportFormatNicename(x)}
                </li>
              )}
            </ul>
          </td>
        </tr>
        <tr>
          <td>
            <FormattedMessage
              id="export.osma.label"
              defaultMessage="OSM Analytics"
            />:
          </td>
          <td colSpan="3">
            <a href={exportInfo.osma_link} target="_blank">
              <FormattedMessage
                id="ui.view_this_area"
                defaultMessage="View this area"
              />
            </a>
          </td>
        </tr>
      </tbody>
    </Table>
  );
};

class ExportRuns extends Component {
  componentWillMount() {
    const { getRuns, jobUid } = this.props;

    getRuns(jobUid);
  }

  componentDidUpdate(prevProps) {
    const { getRuns, jobUid, runs, state_token} = this.props;

    if (prevProps.jobUid !== jobUid) {
      clearInterval(this.poller);
      this.poller = null;
      getRuns(jobUid);
    } else {
      if (runs.length > 0) {
        if (runs[0].status === "FAILED" || runs[0].status === "COMPLETED") {
          clearInterval(this.poller);
          this.poller = null;
        } else if (this.poller == null) {
          this.poller = setInterval(() => getRuns(jobUid), 15e3);
        }
      }
    }
  }

  componentWillUnmount() {
    clearInterval(this.poller);
    this.poller = null;
  }

  render() {
    const runs = this.props.runs;
    return (
      <div>
        {runs.map((run, i) => {
          return (
            <Panel header={formatDate(run.created_at)} key={i}>
              <Table responsive>
                <tbody>
                  <tr>
                    <td>
                      <FormattedMessage
                        id="ui.exports.status"
                        defaultMessage="Status:"
                      />
                    </td>
                    <td colSpan="3">
                      <Alert bsStyle="success" style={{ marginBottom: "0px" }}>
                        {run.status}
                      </Alert>
                    </td>
                  </tr>
                  { (run.status === "SUBMITTED" || run.status === "RUNNING") ?(
                  <RequirePermission required={["auth.add_user"]}>
                    <tr>
                      <td>
                        <FormattedMessage
                          id="ui.exports.action"
                          defaultMessage="Action:"
                        />
                      </td>
                      <td colSpan="3">
                      <Button bsStyle="danger" onClick={() => {
                        try {
                          const token = selectAuthToken(this.props.state_token);
                           axios({
                            baseURL: window.EXPORTS_API_URL,
                            headers: {
                              Authorization: `Bearer ${token}`
                            },
                            method: "GET",
                            url: `/api/cancel_run`,
                            params: {
                              run_uid: run.uid
                            }
                          });
                          window.location.reload();
                        } catch (err) {
                          console.warn(err);
                        }
                      }}>
                        <FormattedMessage id="ui.stop_run" defaultMessage="Force Stop Run" />
                      </Button>
                      </td>
                    </tr>
                  </RequirePermission>
                  ):(console.log('Normal'))}
                  <RequirePermission required={[
          "jobs.add_hdxexportregion",
          "jobs.change_hdxexportregion",
          "jobs.delete_hdxexportregion",
        ]}>
                    <tr>
                      <td>
                        <FormattedMessage
                          id="ui.exports.hdx_sync_status"
                          defaultMessage="HDX Sync Status:"
                        />
                      </td>
                      <td colSpan="3">
                      {run.hdx_sync_status ? "Uploaded " : "Not Uploaded "}

                        <Button
                          bsStyle="success"
                          disabled={run.hdx_sync_status}
                          onClick={async () => {
                            try {
                              const token = selectAuthToken(this.props.state_token);
                              const response = await axios({
                                baseURL: window.EXPORTS_API_URL,
                                headers: {
                                  Authorization: `Bearer ${token}`
                                },
                                method: "GET",
                                url: `/api/sync_to_hdx_api`,
                                params: {
                                  run_uid: run.uid
                                }
                              });
                              alert(response.data.message);
                            } catch (err) {
                              console.warn(err);
                              alert(err);
                            }
                          }}
                        >
                          <FormattedMessage id="ui.resync_hdx" defaultMessage="Resync" />
                        </Button>
                      </td>
                    </tr>
                  </RequirePermission>
                  
                  
                  <tr>
                    <td>
                      <FormattedMessage
                        id="ui.exports.id"
                        defaultMessage="ID:"
                      />
                    </td>
                    <td colSpan="3">
                      {run.uid}
                    </td>
                  </tr>
                  <RequirePermission required={[
          "jobs.add_hdxexportregion",
          "jobs.change_hdxexportregion",
          "jobs.delete_hdxexportregion",
        ]}>
                  <tr>
                    <td>
                      <FormattedMessage
                        id="ui.exports.started"
                        defaultMessage="Started:"
                      />
                    </td>
                    <td colSpan="3">
                      {run.started_at ? formatDate(run.started_at) : ""}
                    </td>
                  </tr>
                  </RequirePermission>
                  <tr>
                    <td>
                      <FormattedMessage
                        id="ui.exports.finished"
                        defaultMessage="Finished:"
                      />
                    </td>
                    <td colSpan="3">
                      {run.finished_at ? formatDate(run.finished_at) : ""}
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <FormattedMessage
                        id="ui.exports.duration"
                        defaultMessage="Duration:"
                      />
                    </td>
                    <td colSpan="3">
                      {formatDuration(run.duration)}
                    </td>
                  </tr>

                  {run.tasks.map((task, i) => {
                    return (
                      <tr key={i}>
                        <td>
                          {exportFormatNicename(task.name)}
                        </td>
                        <td>
                          {task.download_urls.map((dl, j) => {
                            return (
                              <span>
                                <a
                                  key={j}
                                  style={{ display: "block" }}
                                  href={dl.download_url}
                                  target="_blank"
                                  className="matomo_download piwik_download"
                                >
                                  {dl.filename}
                                </a>{" "}
                                ({prettyBytes(dl.filesize_bytes)})
                              </span>
                            );
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </Panel>
          );
        })}
      </div>
    );
  }
}

const ExportRunsContainer = connect(
  state => {
    return {
      runs: state.exportRuns,
      state_token: state,
    };
  },
  {
    getRuns
  }
)(ExportRuns);

export class ExportDetails extends Component {
  state = {
    showDeleteModal: false,
    showModal: false
  }

  componentWillMount() {
    const { getExport, match: { params: { id } } } = this.props;
    getExport(id);
  }

  closeDeleteModal = () =>
    this.setState({ showDeleteModal: false });

  closeModal = () =>
    this.setState({ showModal: false });

  showDeleteModal = () =>
    this.setState({ showDeleteModal: true });

  showModal = () =>
    this.setState({ showModal: true });

  render() {
    const {
      cloneExport,
      deleteExport,
      exportInfo,
      isLoggedIn,
      status: { loading },
      match: { params: { id } },
      runExport,
      username,
    } = this.props;

    const { showDeleteModal, showModal } = this.state;

    let geom;
    let selectedId;
    let requiresFeatureSelection = false;

    if (exportInfo != null) {
      geom = {
        features: [exportInfo.simplified_geom],
        type: "FeatureCollection"
      };

      selectedId = exportInfo.simplified_geom.id;

      requiresFeatureSelection = (exportInfo.export_formats || [])
        .some(x => REQUIRES_FEATURE_SELECTION[x]);
    }

    if (loading) {
      return (
        <NonIdealState
          action={
            <strong>
              <FormattedMessage id="ui.loading" defaultMessage="Loading..." />
            </strong>
          }
          visual={<Spinner />}
        />
      );
    }

    if (exportInfo == null) {
      return (
        <NonIdealState
          action={
            <strong>
              <FormattedMessage
                id="ui.export.not_found"
                defaultMessage="Export Not Found"
              />
            </strong>
          }
          visual="warning-sign"
        />
      );
    }

    return (
      <Row style={{ height: "100%" }}>
        <Col
          xs={4}
          style={{ height: "100%", padding: "20px", paddingRight: "10px" }}
        >
          <Panel header={exportInfo ? exportInfo.name : null}>
            {exportInfo ? <Details exportInfo={exportInfo} /> : null}
            {(requiresFeatureSelection || isLoggedIn) &&
              <ButtonGroup>
                {requiresFeatureSelection &&
                  <Button onClick={this.showModal}>
                    <FormattedMessage
                      id="ui.exports.features"
                      defaultMessage="Features"
                    />
                  </Button>}
                {isLoggedIn &&
                  <Button bsStyle="success" onClick={() => runExport(id)}>
                    <FormattedMessage
                      id="ui.exports.rerun_export"
                      defaultMessage="Re-Run"
                    />
                  </Button>}
                {isLoggedIn &&
                  <Button
                    bsStyle="primary"
                    onClick={() => cloneExport(exportInfo)}
                    {...(exportInfo ? {} : { disabled: true })}
                  >
                    <FormattedMessage
                      id="ui.exports.clone_export"
                      defaultMessage="Clone"
                    />
                  </Button>}
                {exportInfo.user.username === username &&
                  <Button
                    bsStyle="danger"
                    onClick={this.showDeleteModal}
                    {...(exportInfo ? {} : { disabled: true })}
                  >
                    <FormattedMessage
                      id="ui.exports.delete_export"
                      defaultMessage="Delete"
                    />
                  </Button>}
              </ButtonGroup>}
          </Panel>
        </Col>
        <Col
          xs={4}
          style={{
            height: "100%",
            padding: "20px",
            paddingLeft: "10px",
            overflowY: "scroll"
          }}
        >
          {exportInfo ? <ExportRunsContainer jobUid={id} /> : null}
        </Col>
        <Col xs={4} style={{ height: "100%" }}>
          <MapListView features={geom} selectedFeatureId={selectedId} />
        </Col>
        <Modal show={showDeleteModal} onHide={this.closeDeleteModal}>
          <Modal.Header closeButton>
            <Modal.Title>
              <FormattedMessage
                id="ui.exports.confirm_delete.title"
                defaultMessage="Confirm Delete"
              />
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <FormattedMessage
              id="ui.exports.confirm_delete.body"
              defaultMessage="Are you sure you wish to delete this export?"
            />
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={this.closeDeleteModal}>
              <FormattedMessage id="ui.cancel" defaultMessage="Cancel" />
            </Button>
            <Button bsStyle="danger" onClick={() => deleteExport(exportInfo)}>
              <FormattedMessage id="ui.delete" defaultMessage="Delete" />
            </Button>
          </Modal.Footer>
        </Modal>
        <Modal show={showModal} onHide={this.closeModal}>
          <Modal.Header closeButton>
            <Modal.Title>
              <FormattedMessage
                id="ui.exports.feature_selection.title"
                defaultMessage="Feature Selection"
              />
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <pre>
              {exportInfo ? exportInfo.feature_selection : ""}
            </pre>
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={this.closeModal}>
              <FormattedMessage id="ui.close" defaultMessage="Close" />
            </Button>
          </Modal.Footer>
        </Modal>
      </Row>
    );
  }
}

const mapStateToProps = state => {
  return {
    exportInfo: state.exportInfo,
    isLoggedIn: selectIsLoggedIn(state),
    status: selectStatus(state),
    username: selectUsername(state),
  };
};

export default connect(mapStateToProps, {
  cloneExport,
  deleteExport,
  getExport,
  runExport
})(ExportDetails);
