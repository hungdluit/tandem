import * as cx from "classnames";
import * as React from "react";
import { Editor } from "tandem-front-end/models/editor";
import { IActor } from "tandem-common/actors";
import { SetToolAction } from "tandem-front-end/actions";
import { FrontEndApplication } from "tandem-front-end/application";
import { EditorToolFactoryDependency } from "tandem-front-end/dependencies";

class ToolComponent extends React.Component<{ app: FrontEndApplication, editor: Editor, toolDependency: EditorToolFactoryDependency }, any> {

  setTool = () => {
    this.props.app.bus.execute(new SetToolAction(this.props.toolDependency));
  }

  render() {
    const dep = this.props.toolDependency;

    const className = cx({
      selected: this.props.editor.currentTool instanceof this.props.toolDependency.clazz,
      [`m-preview-tool s s-${this.props.toolDependency.icon}`]: true,
    });

    return (
      <li
        className={className}
        tabIndex="-1"
        onClick={this.setTool}
        title={`${dep.id} (${dep.keyCommand})`}
      >

      </li>
    );
  }
}

export default ToolComponent;