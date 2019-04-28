/**
 * Replicate function
 * Create exact copy of an existing application
 * @param {*} definition <object>
 *  - name 
 *  - create
 *  - type
 */
ApplicationInstance.prototype.replicate = function(definition) {
    var $defer = new _Promise();
    definition.current = this.name;
    if (!definition.name) {
        definition.name = this.name + "_copy";
    }
};