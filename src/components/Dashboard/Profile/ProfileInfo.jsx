const ProfileInfo = () => {
  return (
    <div className="profile-info-show">
      <h1 className="title">You Profile Info</h1>

      <div className="info-container">
        <div className="info-tab">
          <label>Name</label>
          <input type="text" placeholder="Your Name" />
        </div>

        <div className="info-tab">
          <label>Email</label>
          <input type="text" placeholder="Your Email" />
        </div>

        <div className="info-tab">
          <label>Country</label>
          <select>
            <option>Select Country</option>
            <option>India</option>
          </select>
        </div>

        <div className="info-tab">
          <label>Mobile</label>
          <input type="text" placeholder="Your Mobile No" />
        </div>

        <div className="info-tab">
          <label>State</label>
          <select>
            <option value="">Select State</option>
            <option value="">Bihar</option>
            <option value="">Dehli</option>
          </select>
        </div>

        <div className="info-tab">
          <label>District</label>
          <select>
            <option value="">Select District</option>
            <option value={"Darbhanga"}>Darbhanga</option>
            <option value={"Patna"}>Patna</option>
          </select>
        </div>

        <div className="info-tab">
          <label>Pin</label>
          <input type="text" placeholder="Your Pincode" />
        </div>

        <div className="info-tab">
          <label>Transaction Password</label>
          <div style={{ position: "relative" }}>
            <input type="password" placeholder="Transaction Password" />
          </div>
        </div>

        <button className="btn">Update</button>
      </div>
    </div>
  );
};

export default ProfileInfo;
