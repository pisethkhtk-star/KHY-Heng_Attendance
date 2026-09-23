package com.hrchomnan.backend.payload.response;

import com.hrchomnan.backend.constants.Constants;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageRes {
    private String code;
    private String message;
    private String messageKh;
    private String messageCh;
    private Object data;

    public MessageRes(Object data) {
        this.code = Constants.CODE_SUCCESS;
        this.message = Constants.MSG_SUCCESS;
        this.messageKh = Constants.MSG_SUCCESS_KH;
        this.data = data;
    }

    public MessageRes(String message, Object data) {
        this.code = Constants.CODE_SUCCESS;
        this.message = message;
        this.messageKh = Constants.MSG_SUCCESS_KH;
        this.data = data;
    }

    public static MessageRes ok(Object data) {
        return new MessageRes(data);
    }

    public static MessageRes ok(String message, Object data) {
        MessageRes res = new MessageRes(data);
        res.setMessage(message);
        return res;
    }

    public static MessageRes created(Object data) {
        MessageRes res = new MessageRes();
        res.setMessageCreateSuccess(data);
        return res;
    }

    public void setMessageSuccess(Object data) {
        this.code = Constants.CODE_SUCCESS;
        this.message = Constants.MSG_SUCCESS;
        this.messageKh = Constants.MSG_SUCCESS_KH;
        this.data = data;
    }

    public void setMessageCreateSuccess(Object data) {
        this.code = Constants.CODE_SUCCESS;
        this.message = Constants.MSG_CREATED;
        this.messageKh = Constants.MSG_CREATED_KH;
        this.data = data;
    }

    public void setMessageUpdateSuccess(Object data) {
        this.code = Constants.CODE_SUCCESS;
        this.message = Constants.MSG_UPDATED;
        this.messageKh = Constants.MSG_UPDATED_KH;
        this.data = data;
    }

    public void setMessageDeleteSuccess(Object data) {
        this.code = Constants.CODE_SUCCESS;
        this.message = Constants.MSG_DELETED;
        this.messageKh = Constants.MSG_DELETED_KH;
        this.data = data;
    }

    public void badRequest(Object data) {
        this.code = Constants.CODE_BAD_REQUEST;
        this.message = Constants.MSG_BAD_REQUEST;
        this.messageKh = Constants.MSG_BAD_REQUEST_KH;
        this.data = data;
    }

    public void notFound(Object data) {
        this.code = Constants.CODE_NOT_FOUND;
        this.message = Constants.MSG_NOT_FOUND;
        this.messageKh = Constants.MSG_NOT_FOUND_KH;
        this.data = data;
    }

    public void internalServerError(Object data) {
        this.code = Constants.CODE_SERVER_ERROR;
        this.message = Constants.MSG_SERVER_ERROR;
        this.messageKh = Constants.MSG_SERVER_ERROR_KH;
        this.data = data;
    }
}
