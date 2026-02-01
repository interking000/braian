class Cdn {
    constructor(id, name, url, status) {
        this.id = id;
        this.name = name;
        this.url = url;
        this.status = status;
    }

    static fromJson(data) {
        return new Cdn(
            data.id,
            data.name,
            data.url,
            data.status,
        );
    }
}

export default Cdn
